let ctx;

function tone(freq, duration, gain, type = 'sine') {
  if (!ctx) ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = type;
  amp.gain.value = gain;
  amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playGameSound(sound, enabled = true) {
  if (!enabled) return;
  if (sound === 'hit') tone(170, 0.12, 0.18, 'square');
  if (sound === 'four') { tone(260, 0.16, 0.16); setTimeout(() => tone(520, 0.22, 0.12), 90); }
  if (sound === 'six') { tone(220, 0.18, 0.16); setTimeout(() => tone(660, 0.3, 0.14), 100); }
  if (sound === 'wicket') { tone(92, 0.35, 0.2, 'sawtooth'); setTimeout(() => tone(60, 0.28, 0.16), 120); }
  if (sound === 'miss') tone(120, 0.08, 0.08, 'triangle');
}
