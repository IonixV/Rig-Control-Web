import { describe, expect, it } from 'vitest';
import { inferTuneMode } from './usePotaSpots';

// The three filter/dedupe/sort pipelines (POTA/SOTA/WWFF) aren't unit-tested
// here — they're only reachable through a live fetch() effect with no
// exposed setter, and unifying their subtly-different timestamp handling
// would be a real production refactor, not a mechanical extraction. Only
// the tune-to-spot mode inference — identical across all three spot types —
// is extracted and tested. See TESTING_PLAN.md's Tier 2 section.

describe('inferTuneMode', () => {
  it('maps SSB to USB at/above 10 MHz, LSB below', () => {
    expect(inferTuneMode('SSB', 14.313, [])).toBe('USB');
    expect(inferTuneMode('SSB', 10, [])).toBe('USB');
    expect(inferTuneMode('SSB', 3.985, [])).toBe('LSB');
  });

  it('maps CW to CW at/above 10 MHz, CWR below', () => {
    expect(inferTuneMode('CW', 14.02, [])).toBe('CW');
    expect(inferTuneMode('CW', 10, [])).toBe('CW');
    expect(inferTuneMode('CW', 3.5, [])).toBe('CWR');
  });

  it('maps FT8/FT4 to PKTUSB when the rig supports it', () => {
    expect(inferTuneMode('FT8', 14.074, ['USB', 'LSB', 'PKTUSB'])).toBe('PKTUSB');
    expect(inferTuneMode('FT4', 7.047, ['USB', 'LSB', 'PKTUSB'])).toBe('PKTUSB');
  });

  it('falls back to USB for FT8/FT4 when the rig has no PKTUSB mode', () => {
    expect(inferTuneMode('FT8', 14.074, ['USB', 'LSB'])).toBe('USB');
    expect(inferTuneMode('FT4', 7.047, [])).toBe('USB');
  });

  it('passes through any other mode unchanged', () => {
    expect(inferTuneMode('USB', 14.313, [])).toBe('USB');
    expect(inferTuneMode('RTTY', 14.08, [])).toBe('RTTY');
  });
});
