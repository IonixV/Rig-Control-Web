import fs from 'fs';
import path from 'path';

// Shared WAV writer for Chromium's --use-file-for-fake-audio-capture flag —
// mono 48kHz 16-bit PCM matches the app's own audio pipeline (CLAUDE.md's
// Audio Pipeline section). Chromium's default fake mic (no file given) is
// silent, not a tone — confirmed empirically via audio-panels.spec.ts's
// spectrum canvas never changing without one — so any test that needs to
// see the signal actually move requires a real file.
const SAMPLE_RATE = 48000;

function writeWavFile(filePath: string, samples: Int16Array): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

// A short raised-cosine fade in/out avoids the audible/spectral clicks a
// hard-edged tone would introduce.
function toneSamples(durationSec: number, freqHz: number, amplitude = 0.6): Int16Array {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Int16Array(n);
  const fadeSamples = Math.min(Math.round(SAMPLE_RATE * 0.01), Math.floor(n / 2));
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < fadeSamples) env = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeSamples);
    else if (i >= n - fadeSamples) env = 0.5 - 0.5 * Math.cos((Math.PI * (n - i)) / fadeSamples);
    samples[i] = Math.round(amplitude * env * 32767 * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE));
  }
  return samples;
}

// A continuous tone (no Morse keying) — enough to prove PCM is actually
// flowing through the pipeline and moving the spectrum display.
export function ensureFakeToneFixture(filePath: string, freqHz = 700, durationSec = 10): string {
  if (fs.existsSync(filePath)) return filePath;
  writeWavFile(filePath, toneSamples(durationSec, freqHz));
  return filePath;
}

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

// Standard PARIS-timing on/off segments for one pass of `text`: dit = 1
// unit, dah = 3 units, intra-character gap = 1 unit, inter-character gap =
// 3 units, inter-word gap = 7 units (a leading space counts as a word gap).
function morseSegments(text: string, ditMs: number): Array<{ on: boolean; durMs: number }> {
  const segments: Array<{ on: boolean; durMs: number }> = [];
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') {
      segments.push({ on: false, durMs: ditMs * 7 });
      continue;
    }
    const code = MORSE[ch];
    if (!code) continue;
    for (let i = 0; i < code.length; i++) {
      segments.push({ on: true, durMs: code[i] === '.' ? ditMs : ditMs * 3 });
      if (i < code.length - 1) segments.push({ on: false, durMs: ditMs });
    }
    segments.push({ on: false, durMs: ditMs * 3 });
  }
  return segments;
}

// Renders on/off segments into PCM samples — "on" segments get a
// raised-cosine fade in/out (a few ms) so element edges don't click, which
// could otherwise confuse GGMorse's envelope detection.
function renderSegments(segments: Array<{ on: boolean; durMs: number }>, freqHz: number, amplitude: number): Int16Array {
  const totalSamples = segments.reduce((sum, s) => sum + Math.round((SAMPLE_RATE * s.durMs) / 1000), 0);
  const out = new Int16Array(totalSamples);
  let offset = 0;
  let phase = 0;
  for (const seg of segments) {
    const n = Math.round((SAMPLE_RATE * seg.durMs) / 1000);
    if (seg.on) {
      const fadeSamples = Math.min(Math.round(SAMPLE_RATE * 0.004), Math.floor(n / 2));
      for (let i = 0; i < n; i++) {
        let env = 1;
        if (i < fadeSamples) env = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeSamples);
        else if (i >= n - fadeSamples) env = 0.5 - 0.5 * Math.cos((Math.PI * (n - i)) / fadeSamples);
        out[offset + i] = Math.round(amplitude * env * 32767 * Math.sin(phase));
        phase += (2 * Math.PI * freqHz) / SAMPLE_RATE;
      }
    }
    // seg.off leaves the slice as zeros (already the Int16Array default).
    offset += n;
  }
  return out;
}

// A Morse-timed WAV — PARIS-standard element timing at `wpm`, keyed at
// `freqHz` — for CwDecodePanel's GGMorse decoder to pick up. `repeats`
// pads the message with word gaps and repeats it so a PTT-on test window
// doesn't need to line up perfectly with a single pass.
export function ensureFakeMorseFixture(
  filePath: string,
  text: string,
  wpm = 18,
  freqHz = 700,
  repeats = 4,
): string {
  if (fs.existsSync(filePath)) return filePath;
  const ditMs = 1200 / wpm;
  const leadInMs = 500;
  let segments: Array<{ on: boolean; durMs: number }> = [{ on: false, durMs: leadInMs }];
  for (let i = 0; i < repeats; i++) {
    segments = segments.concat(morseSegments(text, ditMs));
    segments.push({ on: false, durMs: ditMs * 7 });
  }
  writeWavFile(filePath, renderSegments(segments, freqHz, 0.6));
  return filePath;
}
