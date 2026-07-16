import { describe, expect, it } from 'vitest';
import { amplitudeToPixel, COLORMAP_CLASSIC } from './spectrumColors';

// A synthetic identity map (map[n] === n) isolates amplitudeToPixel's own
// clamp/normalize logic from buildColorMap's gradient interpolation, which
// is exercised separately via the COLORMAP_CLASSIC assertions below.
const IDENTITY_MAP = new Uint32Array(256).map((_, i) => i);

describe('amplitudeToPixel', () => {
  it('maps an amplitude at the floor to index 0', () => {
    expect(amplitudeToPixel(-130, -130, -20, IDENTITY_MAP)).toBe(0);
  });

  it('maps an amplitude at the ceiling to index 255', () => {
    expect(amplitudeToPixel(-20, -130, -20, IDENTITY_MAP)).toBe(255);
  });

  it('clamps an amplitude below the floor to index 0', () => {
    expect(amplitudeToPixel(-200, -130, -20, IDENTITY_MAP)).toBe(0);
  });

  it('clamps an amplitude above the ceiling to index 255', () => {
    expect(amplitudeToPixel(0, -130, -20, IDENTITY_MAP)).toBe(255);
  });

  it('maps a midpoint amplitude to the middle of the index range', () => {
    expect(amplitudeToPixel(-75, -130, -20, IDENTITY_MAP)).toBe(128);
  });

  it('produces the documented black-to-white gradient endpoints for COLORMAP_CLASSIC', () => {
    expect(amplitudeToPixel(-130, -130, -20, COLORMAP_CLASSIC)).toBe(0xff000000);
    expect(amplitudeToPixel(-20, -130, -20, COLORMAP_CLASSIC)).toBe(0xffffffff);
  });
});
