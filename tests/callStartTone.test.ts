import { describe, expect, it, vi } from "vitest";
import { startCallStartTone } from "../app/lib/callStartTone";

describe("call start tone", () => {
  it("starts from the user gesture and stops timers and audio idempotently", () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    const oscillator = { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    class AudioContextMock {
      state = "running"; currentTime = 0; destination = {};
      resume = resume; close = close;
      createGain = () => gain as unknown as GainNode;
      createOscillator = () => ({ ...oscillator, frequency: { value: 0 } }) as unknown as OscillatorNode;
    }
    const setTimeout = vi.fn(() => 7);
    const clearTimeout = vi.fn();
    const scope = { AudioContext: AudioContextMock, setTimeout, clearTimeout } as unknown as Window;
    const tone = startCallStartTone(scope);
    expect(resume).toHaveBeenCalledOnce();
    expect(setTimeout).toHaveBeenCalledOnce();
    tone.stop(); tone.stop();
    expect(clearTimeout).toHaveBeenCalledWith(7);
    expect(close).toHaveBeenCalledOnce();
  });
});
