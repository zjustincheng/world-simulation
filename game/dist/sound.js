export function createSound() {
  let context,
    enabled = true;
  try {
    enabled = localStorage.getItem("world-sound") !== "off";
  } catch {}
  function play(kind = "turn") {
    if (!enabled) return;
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      context ||= new Audio();
      if (context.state === "suspended") context.resume().catch(() => {});
      const notes =
        kind === "conflict"
          ? [110, 130.81, 98]
          : kind === "settle"
            ? [261.63, 392, 523.25]
            : [196, 293.66, 392, 523.25];
      notes.forEach((frequency, i) => {
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        const start = context.currentTime + i * 0.09;
        oscillator.type = kind === "conflict" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.09, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.5);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    } catch {
      /* Sound is optional on browsers without an audio device. */
    }
  }
  return {
    play,
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      if (!enabled && context) context.suspend().catch(() => {});
      try {
        localStorage.setItem("world-sound", enabled ? "on" : "off");
      } catch {}
      if (enabled) play("settle");
      return enabled;
    },
  };
}
