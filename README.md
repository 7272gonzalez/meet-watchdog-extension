# Meet Watchdog — Chrome Extension

Never miss a video call again. Meet Watchdog watches your Google Calendar and alerts you the moment a meeting starts — with a sound, a notification, and a **Join Now** button — if you haven't joined yet.

Works on macOS, Windows, and Linux — anywhere Chrome runs. Supports Google Meet, Zoom, and Microsoft Teams.

---

## How it works

1. Every minute the extension checks your Google Calendar for meetings that are starting now or have recently started.
2. It checks whether you have that meeting open in a Chrome tab.
3. If you haven't joined, it plays a sound, shows a notification with a **Join Now** button, and opens the call link in a new tab.
4. Once it sees you've joined, it stops alerting for that meeting.
5. If you never join, it gives up after a few attempts so it doesn't keep interrupting you.

---

## Installation

### Step 1 — Download the extension

1. Go to the [GitHub repository](https://github.com/7272gonzalez/meet-watchdog-extension)
2. Click the green **Code** button → **Download ZIP**
3. Unzip the downloaded file — you'll get a folder called `meet-watchdog-extension-main`

### Step 2 — Load it into Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `meet-watchdog-extension-main` folder you just unzipped
5. The Meet Watchdog icon (🐶) appears in your Chrome toolbar

### Step 3 — Connect your Google Calendar

1. Click the Meet Watchdog icon in the toolbar
2. Click **Connect Google Calendar**
3. Sign in with your Google account and click **Allow**

That's it — Meet Watchdog starts checking immediately.

---

## Settings

Click the Meet Watchdog icon → **Settings** to customise the behaviour:

| Setting | Default | Description |
|---------|---------|-------------|
| Alert before start | `0` min | Get alerted early — e.g. set to `2` for a 2-minute warning before the meeting starts |
| Grace period | `15` min | Stop alerting this many minutes after the meeting started |
| Max alerts | `3` | Give up after this many attempts if you haven't joined |

---

## Troubleshooting

**No alerts are firing**
- Click the extension icon — if it shows "Not connected", click **Connect Google Calendar** and sign in again
- Make sure the calendar invite contains a Google Meet, Zoom, or Teams link — the extension can only alert for meetings that have a call link
- Make sure Chrome notifications are enabled: Chrome menu → Settings → Privacy and security → Site Settings → Notifications

**Alerts stopped but I never joined**
The extension gives up after the **Max alerts** limit is reached. Click the extension icon → **Reset meeting state** to clear the history and re-enable alerts.

**I joined but alerts kept coming**
The extension detects you as joined by checking for an open Chrome tab with the meeting URL. If you joined via the native Zoom or Teams desktop app (not in Chrome), it won't detect that — the alerts will continue until the max alerts limit is reached.

**I need to reconnect my Google account**
Click the extension icon → **Disconnect**, then click **Connect Google Calendar** to sign in again.

---

## Privacy

Meet Watchdog only reads your calendar event titles, times, and video call links. No data is stored outside your browser or sent anywhere — everything stays on your computer.
