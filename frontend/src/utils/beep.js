// Short POS-style confirmation beep, synthesized with the Web Audio API so
// there's no audio asset to ship or load - matters on the low-end Android
// phones this app targets, where every extra network request counts.
let audioCtx = null;

export const playBeep = () => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 1000;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch {
    // Web Audio unsupported or blocked - the toast/cart update is still
    // enough feedback, so fail silently rather than interrupt the sale.
  }
};
