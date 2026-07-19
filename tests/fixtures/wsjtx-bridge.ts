import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';

export interface WsjtxBridge {
  proc: ChildProcess;
  tcpPort: number;
  wsPort: number;
  stop(): Promise<void>;
}

function getWsjtxBridgePath(baseDir: string): string {
  let platformDir = '';
  if (process.platform === 'win32') platformDir = 'windows';
  else if (process.platform === 'linux') platformDir = 'linux';
  else if (process.platform === 'darwin') platformDir = 'mac';

  const binaryName = process.platform === 'win32' ? 'wsjtx-bridge.exe' : 'wsjtx-bridge';
  return path.join(baseDir, 'bin', platformDir, binaryName);
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object') {
        const { port } = addr;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('Could not determine a free port')));
      }
    });
    srv.on('error', reject);
  });
}

/**
 * Spawns the real `wsjtx-bridge` C binary (already committed and built —
 * see scripts/build-wsjtx-bridge.mjs) on two local ephemeral ports, mirroring
 * how tests/fixtures/rigctld-dummy.ts spawns a real rigctld. `--no-audio`
 * skips PipeWire/pw-loopback virtual device setup entirely — unneeded for
 * exercising the rig-control relay and not assumed present in a CI sandbox.
 */
export async function startWsjtxBridge(baseDir: string): Promise<WsjtxBridge> {
  const binPath = getWsjtxBridgePath(baseDir);
  if (!fs.existsSync(binPath)) {
    throw new Error(`wsjtx-bridge binary not found at ${binPath} — run 'node scripts/build-wsjtx-bridge.mjs'`);
  }

  const tcpPort = await findFreePort();
  const wsPort = await findFreePort();

  const proc = spawn(binPath, [
    '--tcp-port', String(tcpPort),
    '--ws-port', String(wsPort),
    '--no-audio',
  ]);

  let stderr = '';
  proc.stderr?.on('data', (d) => (stderr += d.toString()));

  const readyPromise = new Promise<void>((resolve, reject) => {
    let buf = '';
    const onData = (d: Buffer) => {
      buf += d.toString();
      if (buf.includes(`READY ${tcpPort} ${wsPort}`)) {
        proc.stdout?.off('data', onData);
        resolve();
      }
    };
    proc.stdout?.on('data', onData);
    setTimeout(() => reject(new Error(`wsjtx-bridge did not print READY within 5000ms (stderr: ${stderr})`)), 5000);
  });

  const exitPromise = new Promise<never>((_, reject) => {
    proc.once('exit', (code) => {
      reject(new Error(`wsjtx-bridge exited early (code ${code}): ${stderr}`));
    });
  });

  await Promise.race([readyPromise, exitPromise]);

  return {
    proc,
    tcpPort,
    wsPort,
    stop: () => stopProcess(proc),
  };
}

function stopProcess(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    proc.once('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill('SIGKILL');
    }, 2000).unref();
  });
}
