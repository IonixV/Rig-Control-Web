import dgram from 'dgram';

export interface SyntheticSpectrumOptions {
  multicastAddr: string;
  multicastPort: number;
  id?: number;
  name?: string;
  type?: 'FIXED' | 'CENTER';
  amplitudes: number[];
  minStrength?: number;
  maxStrength?: number;
  centerFreq?: number;
  span?: number;
  lowFreq?: number;
  highFreq?: number;
  seq?: number;
}

/**
 * Builds and sends a Hamlib 5.x-shaped `spectra[]` JSON packet over UDP to
 * the app's configured multicast group. server/spectrum.ts trusts any
 * correctly-shaped sender, so this stands in for a real radio/rigctld
 * multicast feed without any production code changes.
 */
export function sendSyntheticSpectrumPacket(opts: SyntheticSpectrumOptions): Promise<void> {
  const hexData = opts.amplitudes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');

  const packet = {
    seq: opts.seq ?? 0,
    spectra: [
      {
        id: opts.id ?? 0,
        name: opts.name ?? 'Test',
        type: opts.type ?? 'CENTER',
        length: opts.amplitudes.length,
        data: hexData,
        minStrength: opts.minStrength ?? -130,
        maxStrength: opts.maxStrength ?? -20,
        centerFreq: opts.centerFreq ?? 14074000,
        span: opts.span ?? 25000,
        lowFreq: opts.lowFreq ?? 14061500,
        highFreq: opts.highFreq ?? 14086500,
      },
    ],
  };

  const msg = Buffer.from(JSON.stringify(packet), 'utf8');

  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    sock.send(msg, opts.multicastPort, opts.multicastAddr, (err) => {
      sock.close();
      if (err) reject(err);
      else resolve();
    });
  });
}
