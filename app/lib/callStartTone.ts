export interface CallToneHandle { stop: () => void }

type AudioContextConstructor = new () => AudioContext;

function audioContextClass(scope: Window): AudioContextConstructor | undefined {
  const audioScope = scope as Window & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return audioScope.AudioContext || audioScope.webkitAudioContext;
}

/** Repeating dual-tone while connecting (stopped when the call joins). */
export function startCallStartTone(scope: Window = window): CallToneHandle {
  const AudioContextClass = audioContextClass(scope);
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

/**
 * One-shot hang-up confirmation tone. Call from the End-button click path so it
 * starts under a user gesture (required on iOS Safari).
 */
export function playCallEndTone(scope: Window = window): CallToneHandle {
  const AudioContextClass = audioContextClass(scope);
  if (!AudioContextClass) return { stop: () => undefined };
  const context = new AudioContextClass();
  let stopped = false;
  void context.resume().catch(() => undefined);

  try {
    const now = context.currentTime;
    const gain = context.createGain();
    // Slightly louder than start ring so it cuts through residual call audio.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.015);
    gain.gain.setValueAtTime(0.07, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    gain.connect(context.destination);

    // Descending pair = classic “call ended” cue (not a ringtone).
    const steps: Array<{ frequency: number; at: number; duration: number }> = [
      { frequency: 520, at: 0, duration: 0.14 },
      { frequency: 360, at: 0.12, duration: 0.18 },
    ];
    for (const step of steps) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = step.frequency;
      oscillator.connect(gain);
      oscillator.start(now + step.at);
      oscillator.stop(now + step.at + step.duration);
    }
    scope.setTimeout(() => {
      if (stopped) return;
      stopped = true;
      void context.close().catch(() => undefined);
    }, 400);
  } catch {
    void context.close().catch(() => undefined);
  }

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      void context.close().catch(() => undefined);
    },
  };
}

/** @deprecated Use CallToneHandle — kept for existing imports. */
export type CallStartTone = CallToneHandle;
