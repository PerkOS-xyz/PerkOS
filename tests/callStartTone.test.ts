import { describe, expect, it, vi } from "vitest";
import { playCallEndTone, startCallStartTone } from "../app/lib/callStartTone";

function mockAudioScope() {
  const close = vi.fn().mockResolvedValue(undefined);
  const resume = vi.fn().mockResolvedValue(undefined);
  const oscillator = { frequency: { value: 0 }, type: "sine", connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  class AudioContextMock {
    state = "running"; currentTime = 0; destination = {};
    resume = resume; close = close;
    createGain = () => gain as unknown as GainNode;
    createOscillator = () => ({ ...oscillator, frequency: { value: 0 } }) as unknown as OscillatorNode;
  }
  const setTimeout = vi.fn((fn: () => void, _ms?: number) => {
    // do not auto-fire hang-up close timer unless test wants
    void fn;
    return 7 as unknown as number;
  });
  const clearTimeout = vi.fn();
  const scope = { AudioContext: AudioContextMock, setTimeout, clearTimeout } as unknown as Window;
  return { scope, close, resume, setTimeout, clearTimeout, oscillator, gain };
}

describe("call start tone", () => {
  it("starts from the user gesture and stops timers and audio idempotently", () => {
    const { scope, close, resume, setTimeout, clearTimeout } = mockAudioScope();
    const tone = startCallStartTone(scope);
    expect(resume).toHaveBeenCalledOnce();
    expect(setTimeout).toHaveBeenCalledOnce();
    tone.stop(); tone.stop();
    expect(clearTimeout).toHaveBeenCalledWith(7);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("call end tone", () => {
  it("plays a one-shot descending hang-up cue under the user gesture", () => {
    const { scope, close, resume, oscillator, gain } = mockAudioScope();
    const tone = playCallEndTone(scope);
    expect(resume).toHaveBeenCalledOnce();
    expect(gain.connect).toHaveBeenCalled();
    expect(oscillator.start).toHaveBeenCalled();
    expect(oscillator.stop).toHaveBeenCalled();
    tone.stop();
    expect(close).toHaveBeenCalled();
  });

  it("no-ops safely without AudioContext", () => {
    const scope = { setTimeout: vi.fn(), clearTimeout: vi.fn() } as unknown as Window;
    expect(() => playCallEndTone(scope).stop()).not.toThrow();
  });
});
