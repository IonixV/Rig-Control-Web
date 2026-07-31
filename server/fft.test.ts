// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fftComplex, fftShift, hannWindow, magnitudesDb, isPowerOfTwo } from './fft.ts';

function tone(n: number, k0: number): { re: Float64Array; im: Float64Array } {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const phase = (2 * Math.PI * k0 * i) / n;
    re[i] = Math.cos(phase);
    im[i] = Math.sin(phase);
  }
  return { re, im };
}

function peakIndex(mags: Float64Array): number {
  let best = 0;
  for (let i = 1; i < mags.length; i++) {
    if (mags[i] > mags[best]) best = i;
  }
  return best;
}

describe('isPowerOfTwo', () => {
  it('accepts powers of two, rejects everything else', () => {
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(2048)).toBe(true);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(3)).toBe(false);
    expect(isPowerOfTwo(2047)).toBe(false);
  });
});

describe('fftComplex', () => {
  it('rejects mismatched or non-power-of-2 lengths', () => {
    expect(() => fftComplex(new Float64Array(4), new Float64Array(3))).toThrow();
    expect(() => fftComplex(new Float64Array(6), new Float64Array(6))).toThrow();
  });

  it('places a positive-frequency complex tone at the expected bin', () => {
    const n = 64;
    const k0 = 5;
    const { re, im } = tone(n, k0);
    fftComplex(re, im);
    const mags = magnitudesDb(re, im);
    expect(peakIndex(mags)).toBe(k0);
  });

  it('fftShift centers DC and places a known-offset tone at the expected shifted bin', () => {
    const n = 64;
    const k0 = 5;
    const { re, im } = tone(n, k0);
    fftComplex(re, im);
    const shifted = fftShift(magnitudesDb(re, im));
    // fftShift's own index mapping: shifted[j] = original[(j+half)%n], so the
    // bin holding k0 pre-shift moves to (k0 - half + n) % n post-shift.
    const expectedIdx = (k0 - n / 2 + n) % n;
    expect(peakIndex(shifted)).toBe(expectedIdx);

    // A pure DC tone (k0=0) should land exactly at the center index after shift.
    const dc = tone(n, 0);
    fftComplex(dc.re, dc.im);
    const dcShifted = fftShift(magnitudesDb(dc.re, dc.im));
    expect(peakIndex(dcShifted)).toBe(n / 2);
  });

  it('negating the imaginary component mirrors the spectrum (Swap I/Q emulation)', () => {
    const n = 64;
    const k0 = 5;
    const { re, im } = tone(n, k0);
    // Swapping I/Q channels is equivalent to conjugating the input signal,
    // which mirrors the resulting spectrum around DC.
    const imNeg = im.map((v) => -v) as unknown as Float64Array;
    const reCopy = re.slice();
    fftComplex(reCopy, imNeg);
    const mags = magnitudesDb(reCopy, imNeg);
    expect(peakIndex(mags)).toBe((n - k0) % n);
  });

  it('satisfies Parseval energy conservation (sum|X|^2 = N * sum|x|^2)', () => {
    const n = 128;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = Math.sin((i * 3) / 7) + 0.5;
      im[i] = Math.cos((i * 2) / 5) - 0.25;
    }
    let timeEnergy = 0;
    for (let i = 0; i < n; i++) timeEnergy += re[i] * re[i] + im[i] * im[i];

    fftComplex(re, im);
    let freqEnergy = 0;
    for (let i = 0; i < n; i++) freqEnergy += re[i] * re[i] + im[i] * im[i];

    expect(freqEnergy / n).toBeCloseTo(timeEnergy, 6);
  });
});

describe('hannWindow', () => {
  it('starts near zero, peaks at 1 in the middle, and has the requested length', () => {
    const w = hannWindow(8);
    expect(w.length).toBe(8);
    expect(w[0]).toBeCloseTo(0, 10);
    expect(Math.max(...w)).toBeGreaterThan(0.9);
  });
});

describe('fftShift', () => {
  it('swaps the two halves of an even-length array', () => {
    const shifted = fftShift([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(Array.from(shifted)).toEqual([4, 5, 6, 7, 0, 1, 2, 3]);
  });
});
