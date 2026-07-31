// Feeds a synthetic complex I/Q tone into the iq-loopback fixture's sink, so
// server/iqScope.ts's real naudiodon capture -> FFT -> spectrum-data path has
// something live to process without real hardware. Uses naudiodon directly
// (already a project dependency) rather than an external player binary like
// pw-play/pw-cat, which aren't installed in the CI image.
//
// I = cos, Q = sin at `offsetHz` above center — a single positive-frequency
// spur, deliberately not full-scale (see server/iqScope.test.ts for why a
// near-full-scale tone saturates the encode range and makes "which bin is
// loudest" an arbitrary tie-break among clipped neighbors).
const CHUNK_MS = 20;
const AMPLITUDE = 0.2;
const OPEN_RETRY_ATTEMPTS = 10;
const OPEN_RETRY_DELAY_MS = 300;

let outputStream: any = null;
let interval: ReturnType<typeof setInterval> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startIqTonePlayer(sinkNodeName: string, sampleRate = 48000, offsetHz = 6000): Promise<void> {
  const naudiodon = (await import('naudiodon')) as any;

  // PipeWire's channel negotiation for a just-created loopback node can lag
  // briefly behind node registration/wpctl set-default (confirmed
  // empirically: "Channel count exceeds maximum number of channels for
  // device" shortly after iq-loopback.ts's startIqLoopback() resolves, on
  // both this open and server/iqScope.ts's own capture open) — retrying the
  // open, not just polling for the node to exist, is what's needed here.
  let lastErr: unknown;
  for (let attempt = 0; attempt < OPEN_RETRY_ATTEMPTS; attempt++) {
    const devices = naudiodon.getDevices();
    const dev = devices.find((d: any) => d.name === sinkNodeName && d.maxOutputChannels >= 2);
    if (!dev) {
      lastErr = new Error(`iq-tone-player: sink device "${sinkNodeName}" not found or reports <2 channels`);
      await sleep(OPEN_RETRY_DELAY_MS);
      continue;
    }
    try {
      outputStream = new naudiodon.AudioIO({
        outOptions: {
          channelCount: 2,
          sampleFormat: naudiodon.SampleFormat16Bit,
          sampleRate,
          deviceId: dev.id,
          closeOnError: true,
        },
      });
      outputStream.start();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      outputStream = null;
      await sleep(OPEN_RETRY_DELAY_MS);
    }
  }
  if (lastErr) throw lastErr;

  const chunkFrames = Math.round((sampleRate * CHUNK_MS) / 1000);
  const phaseStep = (2 * Math.PI * offsetHz) / sampleRate;
  let phase = 0;

  interval = setInterval(() => {
    if (!outputStream) return;
    const buf = Buffer.alloc(chunkFrames * 4);
    for (let i = 0; i < chunkFrames; i++) {
      buf.writeInt16LE(Math.round(AMPLITUDE * 32767 * Math.cos(phase)), i * 4);
      buf.writeInt16LE(Math.round(AMPLITUDE * 32767 * Math.sin(phase)), i * 4 + 2);
      phase += phaseStep;
      if (phase > Math.PI * 2) phase -= Math.PI * 2;
    }
    outputStream.write(buf);
  }, CHUNK_MS);
}

export function stopIqTonePlayer(): void {
  if (interval) { clearInterval(interval); interval = null; }
  if (outputStream) {
    try { outputStream.quit(); } catch { /* already stopped */ }
    outputStream = null;
  }
}
