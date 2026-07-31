// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildIqSpectrumFrame, IQ_FFT_SIZE, IQ_ENCODE_MIN_DB, IQ_ENCODE_MAX_DB } from './iqScope.ts';
import { hannWindow } from './fft.ts';

const SAMPLE_RATE = 48000;
const CENTER_FREQ = 14074000;
// 48000/2048 = 23.4375 Hz/bin exactly, and 6000/23.4375 = 256 exactly — an
// offset that lands precisely on a bin, avoiding rounding ambiguity in the
// peak-bin assertions below.
const OFFSET_HZ = 6000;
const K0 = (OFFSET_HZ * IQ_FFT_SIZE) / SAMPLE_RATE;

const window = hannWindow(IQ_FFT_SIZE);

function preShiftToPostShift(k: number, n: number): number {
  return (((k - n / 2) % n) + n) % n;
}

/**
 * Interleaved 16-bit stereo PCM for a complex tone at bin `k0`: I=cos, Q=sin
 * (positive frequency). Default amplitude is deliberately low (representative
 * of the G90's low-level analog I/Q output, not a full-scale digital tone) so
 * the Hann-windowed peak (~A*fftSize/2 in magnitude) stays within
 * IQ_ENCODE_MAX_DB headroom — a peak that saturates the encode range clips
 * several neighboring sidelobe bins to the same byte value, making "which
 * bin is the max" an arbitrary tie-break rather than a meaningful assertion.
 */
function complexTonePcm(k0: number, amplitude = 0.01): Buffer {
  const buf = Buffer.alloc(IQ_FFT_SIZE * 4);
  for (let i = 0; i < IQ_FFT_SIZE; i++) {
    const phase = (2 * Math.PI * k0 * i) / IQ_FFT_SIZE;
    const iSample = Math.round(amplitude * 32767 * Math.cos(phase));
    const qSample = Math.round(amplitude * 32767 * Math.sin(phase));
    buf.writeInt16LE(iSample, i * 4);
    buf.writeInt16LE(qSample, i * 4 + 2);
  }
  return buf;
}

function peakIndex(amplitudes: number[]): number {
  let best = 0;
  for (let i = 1; i < amplitudes.length; i++) {
    if (amplitudes[i] > amplitudes[best]) best = i;
  }
  return best;
}

describe('buildIqSpectrumFrame', () => {
  it('rejects a PCM buffer of the wrong length', () => {
    expect(() =>
      buildIqSpectrumFrame({
        pcm: Buffer.alloc(10),
        fftSize: IQ_FFT_SIZE,
        sampleRate: SAMPLE_RATE,
        centerFreq: CENTER_FREQ,
        swapChannels: false,
        window,
      }),
    ).toThrow();
  });

  it('places a known-offset complex tone at the expected shifted bin', () => {
    const pcm = complexTonePcm(K0);
    const frame = buildIqSpectrumFrame({
      pcm,
      fftSize: IQ_FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      centerFreq: CENTER_FREQ,
      swapChannels: false,
      window,
    });
    const expectedIdx = preShiftToPostShift(K0, IQ_FFT_SIZE);
    expect(peakIndex(frame.amplitudes)).toBe(expectedIdx);
  });

  it('swapChannels mirrors the peak to the opposite side of center (HDSDR-style Swap IQ)', () => {
    const pcm = complexTonePcm(K0);
    const normal = buildIqSpectrumFrame({
      pcm,
      fftSize: IQ_FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      centerFreq: CENTER_FREQ,
      swapChannels: false,
      window,
    });
    const swapped = buildIqSpectrumFrame({
      pcm,
      fftSize: IQ_FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      centerFreq: CENTER_FREQ,
      swapChannels: true,
      window,
    });
    const normalIdx = peakIndex(normal.amplitudes);
    const swappedIdx = peakIndex(swapped.amplitudes);
    const center = IQ_FFT_SIZE / 2;
    expect(swappedIdx).not.toBe(normalIdx);
    // Both peaks should be equidistant from the center (DC) bin, on opposite sides.
    expect(swappedIdx - center).toBe(-(normalIdx - center));
  });

  it('derives span/lowFreq/highFreq from sampleRate and centerFreq', () => {
    const pcm = complexTonePcm(0);
    const frame = buildIqSpectrumFrame({
      pcm,
      fftSize: IQ_FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      centerFreq: CENTER_FREQ,
      swapChannels: false,
      window,
    });
    expect(frame.span).toBe(SAMPLE_RATE);
    expect(frame.lowFreq).toBe(CENTER_FREQ - SAMPLE_RATE / 2);
    expect(frame.highFreq).toBe(CENTER_FREQ + SAMPLE_RATE / 2);
    expect(frame.name).toBe('Audio I/Q');
    expect(frame.minLevel).toBe(IQ_ENCODE_MIN_DB);
    expect(frame.maxLevel).toBe(IQ_ENCODE_MAX_DB);
    expect(frame.length).toBe(IQ_FFT_SIZE);
    expect(frame.amplitudes.length).toBe(IQ_FFT_SIZE);
  });

  it('keeps every amplitude byte within [0,255]', () => {
    const pcm = complexTonePcm(K0, 1.0);
    const frame = buildIqSpectrumFrame({
      pcm,
      fftSize: IQ_FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      centerFreq: CENTER_FREQ,
      swapChannels: false,
      window,
    });
    for (const a of frame.amplitudes) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(255);
    }
  });

  it('produces a much quieter peak for silence than for a tone', () => {
    const silence = Buffer.alloc(IQ_FFT_SIZE * 4);
    const silentFrame = buildIqSpectrumFrame({
      pcm: silence,
      fftSize: IQ_FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      centerFreq: CENTER_FREQ,
      swapChannels: false,
      window,
    });
    const toneFrame = buildIqSpectrumFrame({
      pcm: complexTonePcm(K0),
      fftSize: IQ_FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      centerFreq: CENTER_FREQ,
      swapChannels: false,
      window,
    });
    expect(Math.max(...toneFrame.amplitudes)).toBeGreaterThan(Math.max(...silentFrame.amplitudes));
  });
});
