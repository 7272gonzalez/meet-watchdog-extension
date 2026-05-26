const DEFAULTS = {
  alertBeforeMinutes: 0,
  gracePeriodMinutes: 15,
  maxAlerts: 3,
  alertSound: 'rapidBeeps',
};

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('alertBefore').value  = stored.alertBeforeMinutes;
  document.getElementById('gracePeriod').value  = stored.gracePeriodMinutes;
  document.getElementById('maxAlerts').value    = stored.maxAlerts;
  document.getElementById('alertSound').value   = stored.alertSound;
}

document.getElementById('save').addEventListener('click', async () => {
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const values = {
    alertBeforeMinutes: clamp(parseInt(document.getElementById('alertBefore').value, 10) || 0,  0,  30),
    gracePeriodMinutes: clamp(parseInt(document.getElementById('gracePeriod').value, 10) || 15, 1,  60),
    maxAlerts:          clamp(parseInt(document.getElementById('maxAlerts').value,   10) || 3,  1,  10),
    alertSound:         document.getElementById('alertSound').value,
  };

  await chrome.storage.sync.set(values);

  // Notify background to reload config
  chrome.runtime.sendMessage({ type: 'config-updated', values });

  const saved = document.getElementById('saved');
  saved.style.display = 'inline';
  setTimeout(() => (saved.style.display = 'none'), 2000);
});

// ── Sound preview (plays directly in the options page — no offscreen needed) ──

document.getElementById('previewSound').addEventListener('click', () => {
  const sound = document.getElementById('alertSound').value;
  previewSound(sound);
});

function previewSound(name) {
  const ctx = new AudioContext();
  switch (name) {
    case 'chime':      previewChime(ctx);      break;
    case 'siren':      previewSiren(ctx);      break;
    case 'buzzer':     previewBuzzer(ctx);     break;
    default:           previewRapidBeeps(ctx); break;
  }
}

function previewChime(ctx) {
  [[880, 0, 0.18], [660, 0.2, 0.38]].forEach(([freq, start, end]) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + end);
  });
}

function previewRapidBeeps(ctx) {
  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(1050, ctx.currentTime);
    const t = ctx.currentTime + i * 0.22;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.01);
    gain.gain.setValueAtTime(0.35, t + 0.12);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.start(t); osc.stop(t + 0.16);
  }
}

function previewSiren(ctx) {
  for (let rep = 0; rep < 2; rep++) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    const t = ctx.currentTime + rep * 1.0;
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.45);
    osc.frequency.linearRampToValueAtTime(400,  t + 0.9);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.setValueAtTime(0.3, t + 0.85);
    gain.gain.linearRampToValueAtTime(0, t + 0.95);
    osc.start(t); osc.stop(t + 0.96);
  }
}

function previewBuzzer(ctx) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, ctx.currentTime);
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.setValueAtTime(0.5, ctx.currentTime + 0.55);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.65);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.66);
}

load();
