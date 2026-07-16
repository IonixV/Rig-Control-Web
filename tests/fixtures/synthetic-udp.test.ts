// @vitest-environment node
import dgram from 'dgram';
import { describe, expect, it } from 'vitest';
import { sendSyntheticSpectrumPacket } from './synthetic-udp.ts';

// Mirrors the decode path in server/spectrum.ts's UDP "message" handler, so
// this test proves the fixture produces a packet that path would actually
// accept and decode correctly — without spinning up the whole app/server.
function decodeLikeSpectrumListener(msg: Buffer) {
  const packet = JSON.parse(msg.toString('utf8'));
  const spectrum = packet.spectra?.[0];
  const hexData: string = spectrum.data || '';
  const amplitudes: number[] = [];
  for (let i = 0; i + 1 < hexData.length; i += 2) {
    amplitudes.push(parseInt(hexData.slice(i, i + 2), 16));
  }
  return {
    id: spectrum.id ?? 0,
    name: spectrum.name ?? '',
    type: spectrum.type ?? 'CENTER',
    length: spectrum.length ?? amplitudes.length,
    amplitudes,
    minLevel: spectrum.minStrength ?? 0,
    maxLevel: spectrum.maxStrength ?? 255,
    centerFreq: spectrum.centerFreq ?? 0,
    span: spectrum.span ?? 0,
    lowFreq: spectrum.lowFreq ?? 0,
    highFreq: spectrum.highFreq ?? 0,
  };
}

describe('sendSyntheticSpectrumPacket', () => {
  it('sends a packet that decodes identically to a real Hamlib spectrum frame', async () => {
    const multicastAddr = '239.255.42.99';
    const multicastPort = 24531; // test-only port, distinct from the app default (4531)

    const listener = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const received = new Promise<Buffer>((resolve, reject) => {
      listener.on('message', (msg) => resolve(msg));
      listener.on('error', reject);
    });

    await new Promise<void>((resolve) => {
      listener.bind(multicastPort, () => {
        listener.addMembership(multicastAddr);
        resolve();
      });
    });

    try {
      const amplitudes = [0, 128, 255, 64, 200];
      await sendSyntheticSpectrumPacket({
        multicastAddr,
        multicastPort,
        amplitudes,
        centerFreq: 14074000,
        span: 25000,
      });

      const msg = await received;
      const decoded = decodeLikeSpectrumListener(msg);

      expect(decoded.amplitudes).toEqual(amplitudes);
      expect(decoded.centerFreq).toBe(14074000);
      expect(decoded.span).toBe(25000);
      expect(decoded.minLevel).toBe(-130);
      expect(decoded.maxLevel).toBe(-20);
    } finally {
      listener.close();
    }
  }, 10000);
});
