# Meet Watchdog — Chrome Extension

A Chrome extension that alerts you when a Google Meet, Zoom, or Teams call is active on your calendar but you haven't joined. Checks every minute, plays a sound, shows a notification with a **Join Now** button, and opens the call link automatically.

Works on macOS, Windows, and Linux — anywhere Chrome runs.

---

## How it works

1. Every minute the extension checks your Google Calendar for meetings with a video call link that are starting now or recently started.
2. It checks whether Chrome has a tab open with that meeting's URL.
3. If no tab is found, it fires a Chrome notification with a sound and a **Join Now** button, and opens the call link in a new tab.
4. Once it detects you've joined (tab is open after the meeting started), it stops alerting for that meeting.
5. If you never join, it gives up after the configured number of alerts (default: 3).

---

## Installation

### Step 1 — Set up Google Calendar access (developer, one time)

The extension reads Google Calendar via the API. You need to create an OAuth client ID once and put it in the manifest. Everyone who installs the extension shares this client ID — they don't need their own.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project, enable the **Google Calendar API**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Choose **Chrome Extension** as the application type
5. Enter your extension's ID (shown in `chrome://extensions` after loading it once)
6. Copy the **Client ID** and paste it into `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     ...
   }
   ```
7. Add anyone who needs to use the extension as a **test user** under **OAuth consent screen** (up to 100 users before verification is needed)

### Step 2 — Load the extension into Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `meet-watchdog-extension` folder
5. The extension appears in your toolbar

### Step 3 — Connect your Google account

1. Click the Meet Watchdog icon in the Chrome toolbar
2. Click **Connect Google Calendar**
3. Sign in with your Google account and click **Allow**

That's it — the extension starts checking immediately.

---

## Sharing with colleagues

Once you have set up the OAuth client ID and added colleagues as test users:

1. Share the `meet-watchdog-extension` folder (zip it, put it on Google Drive, etc.)
2. Colleagues follow **Step 2** and **Step 3** above — no Google Cloud setup needed on their end

---

## Settings

Click the extension icon → **Settings** to adjust:

| Setting | Default | Description |
|---------|---------|-------------|
| Alert before start | `0` min | How many minutes early to start alerting (`0` = at start time) |
| Grace period | `15` min | Stop watching this many minutes after start |
| Max alerts | `3` | Give up after this many attempts |

---

## Troubleshooting

**No alerts firing**
- Click the extension icon — if it shows "Not connected", click **Connect Google Calendar**
- Make sure the meeting invite contains a Google Meet, Zoom, or Teams link
- Check that Chrome notifications are allowed: Chrome menu → Settings → Privacy → Site Settings → Notifications

**Zoom / Teams: alerts stop after joining**
The extension checks Chrome tabs for the meeting URL. If you join via the native Zoom or Teams desktop app and Chrome no longer has that tab open, the extension cannot detect you as joined — the max alerts limit will eventually stop it.

**Reset meeting state**
Click the extension icon → **Reset meeting state** to clear the history and re-enable alerts for past meetings.
