import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatArg, ts } from './useConsoleCapture';

afterEach(() => {
  vi.useRealTimers();
});

describe('ts', () => {
  it('formats a fixed time as HH:MM:SS.mmm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 5, 3, 42));
    expect(ts()).toBe('09:05:03.042');
  });
});

describe('formatArg', () => {
  it('passes strings through unchanged', () => {
    expect(formatArg('hello')).toBe('hello');
  });

  it('formats an Error as "Name: message"', () => {
    expect(formatArg(new TypeError('bad value'))).toBe('TypeError: bad value');
  });

  it('JSON-stringifies plain objects', () => {
    expect(formatArg({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
  });

  it('falls back to String() for values that cannot be JSON-stringified', () => {
    const circular: any = { a: 1 };
    circular.self = circular;

    expect(() => formatArg(circular)).not.toThrow();
    expect(formatArg(circular)).toBe(String(circular));
  });
});
