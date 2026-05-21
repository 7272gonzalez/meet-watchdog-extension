// Runs in an offscreen document — plays the alert sound via Web Audio API.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'play-sound') return;

  const ctx = new AudioContext();

  // Two-tone alert: high beep followed by a slightly lower one
  [[880, 0, 0.18], [660, 0.2, 0.38]].forEach(([freq, start, end]) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + end);
  });
});
