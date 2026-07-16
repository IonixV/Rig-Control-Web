import { describe, expect, it } from 'vitest';
import { computeDisplayBandwidth } from './SpectrumAudioPanel';

describe('computeDisplayBandwidth', () => {
  it('caps CW-family modes at 1400 Hz', () => {
    expect(computeDisplayBandwidth(2400, 'CW', 5000)).toBe(1400);
    expect(computeDisplayBandwidth(2400, 'CWR', 5000)).toBe(1400);
    expect(computeDisplayBandwidth(2400, 'CW-R', 5000)).toBe(1400);
  });

  it('further caps CW modes to maxHz when maxHz is below 1400', () => {
    expect(computeDisplayBandwidth(2400, 'CW', 1000)).toBe(1000);
  });

  it('adds a 300 Hz margin to the rig-reported bandwidth for non-CW modes', () => {
    expect(computeDisplayBandwidth(2400, 'USB', 5000)).toBe(2700);
  });

  it('treats a bandwidth of 0 as 3000 Hz before adding the margin', () => {
    expect(computeDisplayBandwidth(0, 'USB', 5000)).toBe(3300);
  });

  it('caps the result to maxHz even for non-CW modes', () => {
    expect(computeDisplayBandwidth(2400, 'USB', 2000)).toBe(2000);
  });
});
