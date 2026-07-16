import { describe, expect, it } from 'vitest';
import { formatDuration, formatUptime } from './AdminTab';

describe('formatUptime', () => {
  it('formats sub-minute durations as seconds only', () => {
    expect(formatUptime(0)).toBe('0s');
    expect(formatUptime(5000)).toBe('5s');
  });

  it('formats durations under an hour as minutes and seconds', () => {
    expect(formatUptime(65000)).toBe('1m 5s');
  });

  it('formats durations of an hour or more as hours, minutes, and seconds', () => {
    expect(formatUptime(3661000)).toBe('1h 1m 1s');
    expect(formatUptime(3600000)).toBe('1h 0m 0s');
  });

  it('truncates sub-second remainders', () => {
    expect(formatUptime(1999)).toBe('1s');
  });
});

describe('formatDuration', () => {
  it('formats identically to formatUptime', () => {
    expect(formatDuration(3661000)).toBe(formatUptime(3661000));
    expect(formatDuration(5000)).toBe('5s');
  });
});
