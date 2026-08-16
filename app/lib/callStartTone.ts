export interface CallStartTone { stop: () => void }

type AudioContextConstructor = new () => AudioContext;

export function startCallStartTone(scope: Window = window): CallStartTone {
  const audioScope = scope as Window & { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor };
  const AudioContextClass = audioScope.AudioContext || audioScope.webkitAudioContext;
  if (!AudioContextClass) return { stop: () => undefined };
  const context = new AudioContextClass();
  let stopped = false;
  let timer: number | undefined;
  void context.resume().catch(() => undefined);

  const ring = () => {
    if (stopped || context.state === "closed") return;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
    gain.gain.setValueAtTime(0.035, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    gain.gain.setValueAtTime(0.0001, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.57);
    gain.gain.setValueAtTime(0.035, now + 0.87);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.93);
    gain.connect(context.destination);
    for (const frequency of [440, 480]) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(now);
      oscillator.stop(now + 0.95);
    }
    timer = scope.setTimeout(ring, 2_500);
  };
  ring();
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (timer !== undefined) scope.clearTimeout(timer);
      void context.close().catch(() => undefined);
    },
  };
}
