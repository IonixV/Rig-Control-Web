import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Socket } from 'socket.io-client';
import { useSpectrum } from './useSpectrum';
import type { SpectrumData } from '../types';

// Minimal stub matching only the on/off/emit surface useSpectrum actually uses,
// so tests exercise the hook's reducer logic without a real Socket.io connection.
class StubSocket {
  private handlers = new Map<string, Set<(...args: any[]) => void>>();

  on(event: string, handler: (...args: any[]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((h) => h(...args));
    return true;
  }
}

function makeSpectrumData(overrides: Partial<SpectrumData> = {}): SpectrumData {
  return {
    id: 0,
    name: 'Test',
    type: 'CENTER',
    length: 3,
    amplitudes: [1, 2, 3],
    minLevel: -130,
    maxLevel: -20,
    centerFreq: 14074000,
    span: 25000,
    lowFreq: 14061500,
    highFreq: 14086500,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('useSpectrum', () => {
  it('starts with no spectrum data and defaults disabled/hamlib settings', () => {
    const socket = new StubSocket();
    const { result } = renderHook(() => useSpectrum(socket as unknown as Socket));

    expect(result.current.latestSpectrumRef.current).toBeNull();
    expect(result.current.waterfallHistoryRef.current).toEqual([]);
    expect(result.current.spectrumEnabled).toBe(false);
    expect(result.current.spectrumSettings.source).toBe('hamlib');
  });

  it('stores the latest spectrum-data frame and prepends it to waterfall history', () => {
    const socket = new StubSocket();
    const { result } = renderHook(() => useSpectrum(socket as unknown as Socket));

    const frame1 = makeSpectrumData({ amplitudes: [1, 2, 3] });
    act(() => socket.emit('spectrum-data', frame1));
    expect(result.current.latestSpectrumRef.current).toEqual(frame1);
    expect(result.current.waterfallHistoryRef.current).toEqual([[1, 2, 3]]);

    const frame2 = makeSpectrumData({ amplitudes: [4, 5, 6] });
    act(() => socket.emit('spectrum-data', frame2));
    expect(result.current.latestSpectrumRef.current).toEqual(frame2);
    // Newest frame is prepended.
    expect(result.current.waterfallHistoryRef.current).toEqual([
      [4, 5, 6],
      [1, 2, 3],
    ]);
  });

  it('caps waterfall history at 300 lines', () => {
    const socket = new StubSocket();
    const { result } = renderHook(() => useSpectrum(socket as unknown as Socket));

    act(() => {
      for (let i = 0; i < 305; i++) {
        socket.emit('spectrum-data', makeSpectrumData({ amplitudes: [i] }));
      }
    });

    expect(result.current.waterfallHistoryRef.current).toHaveLength(300);
    // Most recent frame (i = 304) should be first.
    expect(result.current.waterfallHistoryRef.current[0]).toEqual([304]);
  });

  it('updates spectrumSupported from spectrum-supported events', () => {
    const socket = new StubSocket();
    const { result } = renderHook(() => useSpectrum(socket as unknown as Socket));

    expect(result.current.spectrumSupported).toBe(false);
    act(() => socket.emit('spectrum-supported', true));
    expect(result.current.spectrumSupported).toBe(true);
  });

  it('merges spectrumSettings from settings-data events', () => {
    const socket = new StubSocket();
    const { result } = renderHook(() => useSpectrum(socket as unknown as Socket));

    act(() =>
      socket.emit('settings-data', {
        spectrumSettings: { enabled: true, source: 'ft4222' },
      }),
    );

    expect(result.current.spectrumEnabled).toBe(true);
    expect(result.current.spectrumSettings.source).toBe('ft4222');
    // Unrelated defaults are preserved by the merge.
    expect(result.current.spectrumSettings.multicastAddr).toBe('224.0.0.1');
  });
});
