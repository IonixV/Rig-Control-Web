// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkVersionSupported } from './rigctld.ts';

describe('checkVersionSupported', () => {
  it('treats an unknown (null) version as supported', () => {
    expect(checkVersionSupported(null)).toBe(true);
  });

  it('supports the exact minimum version', () => {
    expect(checkVersionSupported('4.7.0')).toBe(true);
  });

  it('supports versions above the minimum', () => {
    expect(checkVersionSupported('5.0.0')).toBe(true);
    expect(checkVersionSupported('4.8.0')).toBe(true);
    expect(checkVersionSupported('4.7.1')).toBe(true);
  });

  it('rejects versions below the minimum', () => {
    expect(checkVersionSupported('4.6.9')).toBe(false);
    expect(checkVersionSupported('4.6.99')).toBe(false);
    expect(checkVersionSupported('3.9.9')).toBe(false);
  });

  it('handles a one-part version string without throwing', () => {
    expect(checkVersionSupported('5')).toBe(true);
    expect(checkVersionSupported('4')).toBe(false);
  });

  it('handles a two-part version string without throwing', () => {
    expect(checkVersionSupported('4.7')).toBe(true);
    expect(checkVersionSupported('4.6')).toBe(false);
  });
});
