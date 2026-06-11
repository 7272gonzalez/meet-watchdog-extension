// Meet Watchdog — background service worker
// Checks Google Calendar every minute and alerts if you haven't joined a call.

// Default config — overridden by values saved in options page
const CONFIG = {
  ALERT_BEFORE_MINUTES:  0,
  GRACE_PERIOD_MINUTES:  15,
  MAX_ALERTS:            3,
  ALERT_SOUND:           'rapidBeeps',
  OWNED_CALENDARS_ONLY:  true,
  ACCEPTED_ONLY:         false,
};

const VALID_SOUNDS = ['chime', 'rapidBeeps', 'siren', 'buzzer', 'phoneRing', 'triplePing', 'windChimes', 'meditationBell', 'dogBark'];

// Sanitise a config values object, falling back to defaults for any out-of-range value.
// Used on both startup load and config-updated message to ensure stored or incoming
// values can never push the time window beyond intended bounds.
function sanitiseConfig(vals) {
  return {
    alertBeforeMinutes:  (Number.isFinite(vals.alertBeforeMinutes) && vals.alertBeforeMinutes >= 0 && vals.alertBeforeMinutes <= 30) ? vals.alertBeforeMinutes : 0,
    gracePeriodMinutes:  (Number.isFinite(vals.gracePeriodMinutes) && vals.gracePeriodMinutes >= 1 && vals.gracePeriodMinutes <= 60) ? vals.gracePeriodMinutes : 15,
    maxAlerts:           (Number.isFinite(vals.maxAlerts)          && vals.maxAlerts          >= 1 && vals.maxAlerts          <= 10) ? vals.maxAlerts          : 3,
    alertSound:          VALID_SOUNDS.includes(vals.alertSound) ? vals.alertSound : 'rapidBeeps',
    ownedCalendarsOnly:  vals.ownedCalendarsOnly !== false,
    acceptedOnly:        vals.acceptedOnly === true, // default false; only true when explicitly set
  };
}

// Load saved config from storage on startup
chrome.storage.sync.get(
  { alertBeforeMinutes: 0, gracePeriodMinutes: 15, maxAlerts: 3, alertSound: 'rapidBeeps', ownedCalendarsOnly: true, acceptedOnly: false },
  (vals) => {
    const safe = sanitiseConfig(vals);
    CONFIG.ALERT_BEFORE_MINUTES = safe.alertBeforeMinutes;
    CONFIG.GRACE_PERIOD_MINUTES = safe.gracePeriodMinutes;
    CONFIG.MAX_ALERTS           = safe.maxAlerts;
    CONFIG.ALERT_SOUND          = safe.alertSound;
    CONFIG.OWNED_CALENDARS_ONLY = safe.ownedCalendarsOnly;
    CONFIG.ACCEPTED_ONLY        = safe.acceptedOnly;
  }
);

const PLATFORM_PATTERNS = {
  Meet:  /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/,
  Zoom:  /https:\/\/(?:[\w-]+\.)?zoom\.us\/j\/[^\s"'<>]+/,
  Teams: /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+/,
};

// Maps notification ID → meeting URL so clicks can open the right link
const notifUrlMap = {};

// Safe URL opener — only opens https:// URLs
function openUrl(url) {
  if (typeof url === 'string' && url.startsWith('https://')) {
    chrome.tabs.create({ url });
  }
}


// ── Auth ──────────────────────────────────────────────────────────────────────

function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

function revokeToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}


// ── Google Calendar API ───────────────────────────────────────────────────────

async function fetchJSON(url, token) {
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${url}`);
  return resp.json();
}

async function getActiveEvents() {
  let token;
  try {
    token = await getAuthToken(false); // non-interactive — don't prompt during background check
  } catch {
    return []; // not signed in yet
  }

  const now        = new Date();
  const windowStart = new Date(now - CONFIG.GRACE_PERIOD_MINUTES * 60000);
  const windowEnd   = new Date(now.getTime() + CONFIG.ALERT_BEFORE_MINUTES * 60000 + 30000);

  const calList = await fetchJSON(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    token
  );

  const events   = [];
  const seenUrls = new Set();

  const calendars = (calList.items || []).filter(
    (cal) => !CONFIG.OWNED_CALENDARS_ONLY || cal.accessRole === 'owner'
  );

  for (const cal of calendars) {
    const params = new URLSearchParams({
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    let data;
    try {
      data = await fetchJSON(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
        token
      );
    } catch {
      continue; // skip inaccessible calendars
    }

    for (const event of data.items || []) {
      // Skip based on RSVP status.
      // selfAttendee is undefined for events with no attendee list (organiser-only
      // or personal events) — those always pass through regardless of settings.
      const selfAttendee = (event.attendees || []).find((a) => a.self);
      const rsvp = selfAttendee?.responseStatus;
      if (rsvp === 'declined') continue;
      if (CONFIG.ACCEPTED_ONLY && rsvp === 'needsAction') continue;

      // Gather all text that might contain a call link
      const raw = [
        event.hangoutLink || '',
        event.location    || '',
        event.description || '',
        ...((event.conferenceData?.entryPoints || []).map((ep) => ep.uri || '')),
      ].join(' ');

      for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
        const match = raw.match(pattern);
        if (!match) continue;

        const url = match[0];
        if (seenUrls.has(url)) break; // same event on multiple calendars
        seenUrls.add(url);

        const startTime      = new Date(event.start.dateTime || event.start.date);
        const secsSinceStart = Math.floor((now - startTime) / 1000);
        // Use the date portion of the start time as part of the state key so that
        // recurring meetings (same URL every week) each get their own state entry.
        const startDate = startTime.toISOString().slice(0, 10);
        events.push({
          title: event.summary || 'Untitled meeting',
          platform,
          url,
          startDate,
          secsSinceStart,
        });
        break;
      }
    }
  }

  return events;
}


// ── Chrome tab detection ──────────────────────────────────────────────────────

async function isInCall(platform, url) {
  let identifier;
  let queryUrl;
  if (platform === 'Meet') {
    identifier = url.split('/').pop().split('?')[0];
    queryUrl = ['https://meet.google.com/*'];
  } else if (platform === 'Zoom') {
    const m = url.match(/\/j\/(\d+)/);
    identifier = m ? m[1] : 'zoom.us/j';
    queryUrl = ['https://*.zoom.us/*'];
  } else {
    identifier = 'teams.microsoft.com/l/meetup-join';
    queryUrl = ['https://teams.microsoft.com/*'];
  }

  const tabs = await chrome.tabs.query({ url: queryUrl });
  return tabs.some((tab) => tab.url && tab.url.includes(identifier));
}


// ── Sound ─────────────────────────────────────────────────────────────────────

async function playAlertSound() {
  // Use an offscreen document to play audio (required in Manifest V3)
  const hasDoc = await chrome.offscreen.hasDocument();
  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play meeting alert sound',
    });
  }
  chrome.runtime.sendMessage({ type: 'play-sound', sound: CONFIG.ALERT_SOUND });
}


// ── Notifications ─────────────────────────────────────────────────────────────

function timeContext(secs) {
  const mins = Math.floor(Math.abs(secs) / 60);
  if (secs < 0) return mins > 0 ? `Starts in ${mins} min` : 'Starting now';
  return mins > 0 ? `Started ${mins} min ago` : 'Just started';
}

function sendNotification(title, body, url) {
  const notifId = `meet-watchdog-${Date.now()}`;
  notifUrlMap[notifId] = url;

  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message: body,
    buttons: [{ title: 'Join Now' }],
    priority: 2,
    requireInteraction: true,
  });
}

chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
  if (buttonIndex === 0 && notifUrlMap[notifId]) {
    openUrl(notifUrlMap[notifId]);
    chrome.notifications.clear(notifId);
    delete notifUrlMap[notifId];
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifUrlMap[notifId]) {
    openUrl(notifUrlMap[notifId]);
    chrome.notifications.clear(notifId);
    delete notifUrlMap[notifId];
  }
});

chrome.notifications.onClosed.addListener((notifId) => {
  delete notifUrlMap[notifId];
});


// ── Main check ────────────────────────────────────────────────────────────────

async function checkMeetings() {
  let events;
  try {
    events = await getActiveEvents();
  } catch (e) {
    console.error('[MeetWatchdog] Failed to get events:', e);
    return;
  }

  if (events.length === 0) return;

  const { meetingState = {} } = await chrome.storage.local.get('meetingState');
  let changed = false;

  // Prune state entries for past dates to prevent unbounded storage growth.
  // Keys are either "url::YYYY-MM-DD" (current format) or bare URLs (legacy).
  // Remove any entry whose date is strictly before today.
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const key of Object.keys(meetingState)) {
    const datePart = key.includes('::') ? key.split('::')[1] : null;
    if (!datePart || datePart < todayStr) {
      delete meetingState[key];
      changed = true;
    }
  }

  for (const { title, platform, url, startDate, secsSinceStart } of events) {
    const stateKey = `${url}::${startDate}`;
    const entry = meetingState[stateKey];

    if (entry === 'attended') continue;

    // After the meeting has started: if tab is open, mark as attended and stop.
    if (secsSinceStart >= 0 && await isInCall(platform, url)) {
      console.log(`[MeetWatchdog] Detected in call: ${title}`);
      meetingState[stateKey] = 'attended';
      changed = true;
      continue;
    }

    // Before the meeting starts: if the tab is already open (joined early),
    // skip alerting — but don't mark attended yet in case the tab is closed
    // before the meeting begins.
    if (secsSinceStart < 0 && await isInCall(platform, url)) {
      console.log(`[MeetWatchdog] Tab open early, skipping alert: ${title}`);
      continue;
    }

    const alertCount = (typeof entry === 'object' && entry?.alerts) || 0;
    if (alertCount >= CONFIG.MAX_ALERTS) {
      console.log(`[MeetWatchdog] Max alerts reached for: ${title}`);
      continue;
    }

    console.log(`[MeetWatchdog] Alerting (${alertCount + 1}/${CONFIG.MAX_ALERTS}): ${title} [${platform}]`);
    sendNotification(
      `Join your ${platform} call!`,
      `${title} — ${timeContext(secsSinceStart)}`,
      url
    );
    playAlertSound();
    openUrl(url);

    meetingState[stateKey] = { alerts: alertCount + 1 };
    changed = true;
  }

  if (changed) {
    await chrome.storage.local.set({ meetingState });
  }
}


// ── Alarm setup ───────────────────────────────────────────────────────────────

chrome.alarms.create('checkMeetings', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkMeetings') checkMeetings();
});

chrome.runtime.onInstalled.addListener(() => checkMeetings());
chrome.runtime.onStartup.addListener(()  => checkMeetings());


// ── Messages from popup ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'sign-in') {
    getAuthToken(true)
      .then(()    => sendResponse({ ok: true }))
      .catch((e)  => sendResponse({ ok: false, error: e.message }));
    return true; // async
  }

  if (msg.type === 'sign-out') {
    getAuthToken(false)
      .then((token) => revokeToken(token))
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'config-updated') {
    const safe = sanitiseConfig(msg.values || {});
    CONFIG.ALERT_BEFORE_MINUTES = safe.alertBeforeMinutes;
    CONFIG.GRACE_PERIOD_MINUTES = safe.gracePeriodMinutes;
    CONFIG.MAX_ALERTS           = safe.maxAlerts;
    CONFIG.ALERT_SOUND          = safe.alertSound;
    CONFIG.OWNED_CALENDARS_ONLY = safe.ownedCalendarsOnly;
    CONFIG.ACCEPTED_ONLY        = safe.acceptedOnly;
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'check-now') {
    checkMeetings()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'get-status') {
    getAuthToken(false)
      .then((token) => sendResponse({ signedIn: !!token }))
      .catch(()     => sendResponse({ signedIn: false }));
    return true;
  }
});
