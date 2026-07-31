export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * In-place iterative radix-2 Cooley-Tukey complex FFT (forward transform,
 * X[k] = sum x[n] * e^(-2*pi*i*k*n/N)). `re`/`im` must have equal,
 * power-of-2 length.
 */
export function fftComplex(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (im.length !== n) throw new Error("fftComplex: re/im length mismatch");
  if (!isPowerOfTwo(n)) throw new Error("fftComplex: length must be a power of 2");
  if (n <= 1) return;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tRe = re[i]; re[i] = re[j]; re[j] = tRe;
      const tIm = im[i]; im[i] = im[j]; im[j] = tIm;
    }
  }

  // Iterative butterfly passes
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curWRe = 1;
      let curWIm = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vRe = re[b] * curWRe - im[b] * curWIm;
        const vIm = re[b] * curWIm + im[b] * curWRe;
        const uRe = re[a];
        const uIm = im[a];
        re[a] = uRe + vRe;
        im[a] = uIm + vIm;
        re[b] = uRe - vRe;
        im[b] = uIm - vIm;
        const nextWRe = curWRe * wRe - curWIm * wIm;
        const nextWIm = curWRe * wIm + curWIm * wRe;
        curWRe = nextWRe;
        curWIm = nextWIm;
      }
    }
  }
}

/** Periodic (not symmetric) Hann window — standard for spectral analysis of framed signals. */
export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  }
  return w;
}

/**
 * Reorders an FFT output so index 0 is the most-negative frequency bin and
 * the center index is DC — matches numpy.fft.fftshift for even-length input
 * (always true here, fftComplex requires power-of-2 length).
 */
export function fftShift(arr: ArrayLike<number>): Float64Array {
  const n = arr.length;
  const half = Math.floor(n / 2);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = arr[(i + half) % n];
  }
  return out;
}

/** 20*log10(magnitude), floored at `epsilonDb` instead of -Infinity for a zero input. */
export function magnitudesDb(re: Float64Array, im: Float64Array, epsilonDb = -300): Float64Array {
  const n = re.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    out[i] = mag > 0 ? 20 * Math.log10(mag) : epsilonDb;
  }
  return out;
}
