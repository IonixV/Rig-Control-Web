import { describe, expect, it } from 'vitest';
import { aColor, geomagColor, kColor, sfiColor } from './SolarPanel';

describe('sfiColor', () => {
  it('is red below 120', () => {
    expect(sfiColor(119)).toBe('text-red-400');
  });
  it('is amber in [120, 150)', () => {
    expect(sfiColor(120)).toBe('text-amber-400');
    expect(sfiColor(149)).toBe('text-amber-400');
  });
  it('is emerald at 150 and above', () => {
    expect(sfiColor(150)).toBe('text-emerald-400');
    expect(sfiColor(200)).toBe('text-emerald-400');
  });
});

describe('aColor', () => {
  it('is emerald below 20', () => {
    expect(aColor(19)).toBe('text-emerald-400');
  });
  it('is amber in [20, 30)', () => {
    expect(aColor(20)).toBe('text-amber-400');
    expect(aColor(29)).toBe('text-amber-400');
  });
  it('is red in [30, 50)', () => {
    expect(aColor(30)).toBe('text-red-400');
    expect(aColor(49)).toBe('text-red-400');
  });
  it('is purple at 50 and above', () => {
    expect(aColor(50)).toBe('text-purple-400');
  });
});

describe('kColor', () => {
  it('is emerald below 4', () => {
    expect(kColor(3)).toBe('text-emerald-400');
  });
  it('is amber in [4, 5)', () => {
    expect(kColor(4)).toBe('text-amber-400');
    expect(kColor(4.9)).toBe('text-amber-400');
  });
  it('is red at 5 and above', () => {
    expect(kColor(5)).toBe('text-red-400');
  });
});

describe('geomagColor', () => {
  it('is emerald for quiet/very quiet, case-insensitively', () => {
    expect(geomagColor('Quiet')).toBe('text-emerald-400');
    expect(geomagColor('VERY QUIET')).toBe('text-emerald-400');
  });
  it('is amber for unsettled/active, case-insensitively', () => {
    expect(geomagColor('Unsettled')).toBe('text-amber-400');
    expect(geomagColor('ACTIVE')).toBe('text-amber-400');
  });
  it('is red for anything else (storm levels)', () => {
    expect(geomagColor('Minor Storm')).toBe('text-red-400');
    expect(geomagColor('Severe Storm')).toBe('text-red-400');
  });
});
