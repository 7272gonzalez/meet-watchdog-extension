// Meet Watchdog — background service worker
// Checks Google Calendar every minute and alerts if you haven't joined a call.

// Default config — overridden by values saved in options page
const CONFIG = {
  ALERT_BEFORE_MINUTES: 0,
  GRACE_PERIOD_MINUTES: 15,
  MAX_ALERTS: 3,
};

// Load saved config from storage on startup
chrome.storage.sync.get(
  { alertBeforeMinutes: 0, gracePeriodMinutes: 15, maxAlerts: 3 },
  (vals) => {
    CONFIG.ALERT_BEFORE_MINUTES = vals.alertBeforeMinutes;
    CONFIG.GRACE_PERIOD_MINUTES = vals.gracePeriodMinutes;
    CONFIG.MAX_ALERTS           = vals.maxAlerts;
  }
);

const PLATFORM_PATTERNS = {
  Meet:  /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/,
  Zoom:  /https:\/\/(?:[\w-]+\.)?zoom\.us\/j\/[^\s"'<>]+/,
  Teams: /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+/,
};

// Maps notification ID → meeting URL so clicks can open the right link
const notifUrlMap = {};


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

  for (const cal of calList.items || []) {
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
      // Skip declined invites
      const declined = (event.attendees || []).some(
        (a) => a.self && a.responseStatus === 'declined'
      );
      if (declined) continue;

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

        const startTime     = new Date(event.start.dateTime || event.start.date);
        const secsSinceStart = Math.floor((now - startTime) / 1000);
        events.push({
          title: event.summary || 'Untitled meeting',
          platform,
          url,
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
  if (platform === 'Meet') {
    identifier = url.split('/').pop().split('?')[0];
  } else if (platform === 'Zoom') {
    const m = url.match(/\/j\/(\d+)/);
    identifier = m ? m[1] : 'zoom.us/j';
  } else {
    identifier = 'teams.microsoft.com/l/meetup-join';
  }

  const tabs = await chrome.tabs.query({});
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
  chrome.runtime.sendMessage({ type: 'play-sound' });
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
    chrome.tabs.create({ url: notifUrlMap[notifId] });
    chrome.notifications.clear(notifId);
    delete notifUrlMap[notifId];
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifUrlMap[notifId]) {
    chrome.tabs.create({ url: notifUrlMap[notifId] });
    chrome.notifications.clear(notifId);
    delete notifUrlMap[notifId];
  }
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

  for (const { title, platform, url, secsSinceStart } of events) {
    const entry = meetingState[url];

    if (entry === 'attended') continue;

    // Only check tab after meeting has started (prevents false positive if link
    // was opened early e.g. to check meeting details)
    if (secsSinceStart >= 0 && await isInCall(platform, url)) {
      console.log(`[MeetWatchdog] Detected in call: ${title}`);
      meetingState[url] = 'attended';
      changed = true;
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
    chrome.tabs.create({ url });

    meetingState[url] = { alerts: alertCount + 1 };
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
      .then((token) => sendResponse({ ok: true, token }))
      .catch((e)    => sendResponse({ ok: false, error: e.message }));
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
    Object.assign(CONFIG, {
      ALERT_BEFORE_MINUTES: msg.values.alertBeforeMinutes,
      GRACE_PERIOD_MINUTES: msg.values.gracePeriodMinutes,
      MAX_ALERTS:           msg.values.maxAlerts,
    });
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
