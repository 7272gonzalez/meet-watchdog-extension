# Meet Watchdog — Chrome Extension

Never miss a video call again. Meet Watchdog watches your Google Calendar and alerts you the moment a meeting starts — with a sound, a notification, and a **Join Now** button — if you haven't joined yet.

Works on macOS, Windows, and Linux — anywhere Chrome runs. Supports Google Meet, Zoom, and Microsoft Teams.

---

## Installation

**[➕ Add to Chrome — Chrome Web Store](https://chromewebstore.google.com/detail/jlihoannalepinffcjbokdjngaadgkln)**

1. Click **Add to Chrome** on the store page and confirm the install
2. Click the Meet Watchdog icon (🐶) in your Chrome toolbar
3. Click **Connect Google Calendar**, sign in, and click **Allow**

That's it — Meet Watchdog starts watching your calendar immediately.

---

## How it works

1. Every minute the extension checks your Google Calendar for meetings that are starting now or have recently started.
2. It checks whether you have that meeting open in a Chrome tab.
3. If you haven't joined, it plays a sound, shows a notification with a **Join Now** button, and opens the call link in a new tab.
4. Once it sees you've joined, it stops alerting for that meeting.
5. If you never join, it gives up after a few attempts so it doesn't keep interrupting you.

---

## Settings

Click the Meet Watchdog icon → **Settings** to customise the behaviour:

| Setting | Default | Description |
|---------|---------|-------------|
| Alert before start | `0` min | Get alerted early — e.g. set to `2` for a 2-minute warning before the meeting starts |
| Grace period | `15` min | Stop alerting this many minutes after the meeting started |
| Max alerts | `3` | Give up after this many attempts if you haven't joined |
| Alert sound | Rapid Beeps | Choose from 9 sounds including chime, siren, phone ring, dog bark, and more |

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

Meet Watchdog only reads your calendar event titles, times, and video call links. No data is stored outside your browser or sent anywhere — everything stays on your computer. See the full [Privacy Policy](https://7272gonzalez.github.io/privacy-policy.html).

---

## For developers — unpacked install

If you want to run the extension from source:

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the repository folder
5. Connect your Google Calendar via the extension popup

Note: the unpacked version uses a different extension ID than the Chrome Web Store version. You will need a separate OAuth client ID configured in Google Cloud Console to use sign-in on the unpacked build.
