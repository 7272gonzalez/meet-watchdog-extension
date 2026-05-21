// Runs in an offscreen document — plays the alert sound via Web Audio API.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'play-sound') return;

  const ctx = new AudioContext();

  // Rapid beeps: 6 quick square-wave bursts at 1050 Hz
  for (let i = 0; i < 6; i++) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(1050, ctx.currentTime);
    const t = ctx.currentTime + i * 0.22;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.01);
    gain.gain.setValueAtTime(0.35, t + 0.12);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.16);
  }
});
