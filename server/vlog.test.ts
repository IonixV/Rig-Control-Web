// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDebugFlag, ts, vlogAudio, vlogRig } from './vlog.ts';

afterEach(() => {
  // debugFlags is shared module-level state — reset whichever flags we
  // touched so tests don't leak into each other.
  setDebugFlag('rig', false);
  setDebugFlag('audio', false);
  vi.useRealTimers();
});

describe('ts', () => {
  it('formats a fixed time as HH:MM:SS.mmm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 5, 3, 42));
    expect(ts()).toBe('09:05:03.042');
  });
});

describe('setDebugFlag', () => {
  it('gates the corresponding vlog* function on/off', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vlogRig('hello');
    expect(spy).not.toHaveBeenCalled();

    setDebugFlag('rig', true);
    vlogRig('hello');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toContain('hello');

    setDebugFlag('rig', false);
    vlogRig('hello again');
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('only affects the flag it was given, not other subsystems', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    setDebugFlag('rig', true);
    vlogAudio('should stay silent');
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
