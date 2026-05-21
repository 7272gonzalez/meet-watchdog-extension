const DEFAULTS = {
  alertBeforeMinutes: 0,
  gracePeriodMinutes: 15,
  maxAlerts: 3,
};

const fields = ['alertBefore', 'gracePeriod', 'maxAlerts'];
const keys   = ['alertBeforeMinutes', 'gracePeriodMinutes', 'maxAlerts'];

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('alertBefore').value  = stored.alertBeforeMinutes;
  document.getElementById('gracePeriod').value  = stored.gracePeriodMinutes;
  document.getElementById('maxAlerts').value    = stored.maxAlerts;
}

document.getElementById('save').addEventListener('click', async () => {
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const values = {
    alertBeforeMinutes: clamp(parseInt(document.getElementById('alertBefore').value, 10) || 0, 0,  30),
    gracePeriodMinutes: clamp(parseInt(document.getElementById('gracePeriod').value, 10) || 15, 1, 60),
    maxAlerts:          clamp(parseInt(document.getElementById('maxAlerts').value,   10) || 3,  1, 10),
  };

  await chrome.storage.sync.set(values);

  // Notify background to reload config
  chrome.runtime.sendMessage({ type: 'config-updated', values });

  const saved = document.getElementById('saved');
  saved.style.display = 'inline';
  setTimeout(() => (saved.style.display = 'none'), 2000);
});

load();
