// @vitest-environment node
import net from 'net';
import { describe, expect, it, afterEach } from 'vitest';
import { startDummyRigctld, type DummyRigctld } from './rigctld-dummy.ts';

function sendCommand(port: number, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      socket.write(cmd + '\n');
    });
    let data = '';
    socket.on('data', (chunk) => {
      data += chunk.toString();
      socket.end();
    });
    socket.on('close', () => resolve(data.trim()));
    socket.on('error', reject);
  });
}

describe('startDummyRigctld', () => {
  let dummy: DummyRigctld | null = null;

  afterEach(async () => {
    if (dummy) {
      await dummy.stop();
      dummy = null;
    }
  });

  it('spawns a real rigctld bound to the Dummy backend and answers get_freq', async () => {
    dummy = await startDummyRigctld(process.cwd());
    const resp = await sendCommand(dummy.port, 'f');
    expect(resp).toMatch(/^\d+$/);
  }, 15000);

  it('stop() terminates the process', async () => {
    dummy = await startDummyRigctld(process.cwd());
    const proc = dummy.proc;
    await dummy.stop();
    expect(proc.exitCode === null ? proc.killed : true).toBe(true);
    dummy = null;
  }, 15000);
});
