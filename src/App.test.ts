import { describe, expect, it } from 'vitest';
import { formatAgcLabel, formatAttenuatorLabel, formatPreampLabel, resolveBackendUrl } from './App';

describe('resolveBackendUrl', () => {
  it('uses the current origin when nothing is stored', () => {
    expect(resolveBackendUrl(null, 'https://localhost:3000')).toEqual({
      url: 'https://localhost:3000',
      reason: 'none',
    });
  });

  it('keeps the stored value when it matches the current origin', () => {
    expect(resolveBackendUrl('https://localhost:3000', 'https://localhost:3000')).toEqual({
      url: 'https://localhost:3000',
      reason: 'none',
    });
  });

  it('corrects a stale http<->https mismatch on the same host/port', () => {
    expect(resolveBackendUrl('http://localhost:3000', 'https://localhost:3000')).toEqual({
      url: 'https://localhost:3000',
      reason: 'protocol-mismatch',
    });
  });

  it('keeps a stored value pointing at a different host/port even if the protocol differs', () => {
    expect(resolveBackendUrl('http://192.168.1.50:3000', 'https://localhost:3000')).toEqual({
      url: 'http://192.168.1.50:3000',
      reason: 'none',
    });
  });

  it('falls back to the current origin when the stored value is not a valid URL', () => {
    expect(resolveBackendUrl('not a url', 'https://localhost:3000')).toEqual({
      url: 'https://localhost:3000',
      reason: 'invalid',
    });
  });
});

describe('formatPreampLabel', () => {
  it('shows "P.AMP" for 0 dB in compact/phone layouts', () => {
    expect(formatPreampLabel(0, true)).toBe('P.AMP');
  });
  it('shows "OFF" for 0 dB outside compact/phone layouts', () => {
    expect(formatPreampLabel(0, false)).toBe('OFF');
  });
  it('shows "{n}dB" for a non-zero value regardless of layout', () => {
    expect(formatPreampLabel(20, true)).toBe('20dB');
    expect(formatPreampLabel(20, false)).toBe('20dB');
  });
});

describe('formatAttenuatorLabel', () => {
  it('shows "ATT" for 0 dB in compact/phone layouts', () => {
    expect(formatAttenuatorLabel(0, true)).toBe('ATT');
  });
  it('shows "OFF" for 0 dB outside compact/phone layouts', () => {
    expect(formatAttenuatorLabel(0, false)).toBe('OFF');
  });
  it('shows "{n}dB" for a non-zero value', () => {
    expect(formatAttenuatorLabel(12, true)).toBe('12dB');
  });
});

describe('formatAgcLabel', () => {
  it('shows "OFF" when no AGC levels are reported', () => {
    expect(formatAgcLabel(6, [])).toBe('OFF');
  });

  it('looks up the label for the current AGC value from "value=label" entries', () => {
    const agcLevels = ['0=OFF', '1=SUPERFAST', '6=SLOW'];
    expect(formatAgcLabel(6, agcLevels)).toBe('SLOW');
  });

  it('falls back to "OFF" when the current value is 0 and not found in the level list', () => {
    expect(formatAgcLabel(0, ['1=SUPERFAST', '6=SLOW'])).toBe('OFF');
  });

  it('falls back to the raw numeric value when non-zero and not found in the level list', () => {
    expect(formatAgcLabel(9, ['1=SUPERFAST', '6=SLOW'])).toBe('9');
  });
});
