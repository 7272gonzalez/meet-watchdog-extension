// Runs in an offscreen document — plays the alert sound via Web Audio API.

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type !== 'play-sound') return;
  playSound(msg.sound || 'rapidBeeps');
});

function playSound(name) {
  const ctx = new AudioContext();
  switch (name) {
    case 'chime':      playChime(ctx);      break;
    case 'siren':      playSiren(ctx);      break;
    case 'buzzer':     playBuzzer(ctx);     break;
    case 'phoneRing':  playPhoneRing(ctx);  break;
    case 'triplePing': playTriplePing(ctx); break;
    default:           playRapidBeeps(ctx); break;  // 'rapidBeeps' + fallback
  }
}

function playChime(ctx) {
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

function playRapidBeeps(ctx) {
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

function playSiren(ctx) {
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

function playBuzzer(ctx) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, ctx.currentTime);
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.setValueAtTime(0.5, ctx.currentTime + 0.55);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.65);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.66);
}

function playPhoneRing(ctx) {
  // Classic telephone: two mixed tones (480 Hz + 620 Hz), two ring bursts
  for (let ring = 0; ring < 2; ring++) {
    const tOn  = ctx.currentTime + ring * 0.9;
    const tOff = tOn + 0.5;
    [480, 620].forEach((freq) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, tOn);
      gain.gain.setValueAtTime(0, tOn);
      gain.gain.linearRampToValueAtTime(0.22, tOn + 0.02);
      gain.gain.setValueAtTime(0.22, tOff - 0.04);
      gain.gain.linearRampToValueAtTime(0, tOff);
      osc.start(tOn); osc.stop(tOff + 0.01);
    });
  }
}

function playTriplePing(ctx) {
  // Three clean sine-wave pings with a natural decay
  [0, 0.32, 0.64].forEach((offset) => {
    const t = ctx.currentTime + offset;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.start(t); osc.stop(t + 0.29);
  });
}
