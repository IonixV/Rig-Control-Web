// @vitest-environment node
import net from 'net';
import { describe, expect, it, afterEach } from 'vitest';
import { startWsjtxBridge, type WsjtxBridge } from './wsjtx-bridge.ts';

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

describe('startWsjtxBridge', () => {
  let bridge: WsjtxBridge | null = null;

  afterEach(async () => {
    if (bridge) {
      await bridge.stop();
      bridge = null;
    }
  });

  it('spawns the real wsjtx-bridge binary and answers a GET "f" from its cache', async () => {
    bridge = await startWsjtxBridge(process.cwd());
    const resp = await sendCommand(bridge.tcpPort, 'f');
    // No browser has pushed rig-status yet, so the cache defaults to "0".
    expect(resp).toBe('0');
  }, 15000);

  it('dump_state reports ptt_type=0x1 (RIG_PTT_RIG), enabling PTT in Hamlib netrigctl', async () => {
    bridge = await startWsjtxBridge(process.cwd());
    const resp = await sendCommand(bridge.tcpPort, 'dump_state');
    expect(resp).toContain('ptt_type=0x1');
    expect(resp.trim().endsWith('done')).toBe(true);
  }, 15000);

  it('stop() terminates the process', async () => {
    bridge = await startWsjtxBridge(process.cwd());
    const proc = bridge.proc;
    await bridge.stop();
    expect(proc.exitCode === null ? proc.killed : true).toBe(true);
    bridge = null;
  }, 15000);
});
