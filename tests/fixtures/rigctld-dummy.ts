import net from 'net';
import { spawn, type ChildProcess } from 'child_process';
import { getRigctldPath } from '../../server/rigctld.ts';

export interface DummyRigctld {
  proc: ChildProcess;
  port: number;
  stop(): Promise<void>;
}

/**
 * Spawns a real `rigctld` bound to Hamlib's built-in Dummy rig backend
 * (model 1) on a local test port, so tests exercise the real Hamlib
 * protocol/parsing path without any physical radio attached.
 */
export async function startDummyRigctld(baseDir: string, port?: number): Promise<DummyRigctld> {
  const rigctldPath = getRigctldPath(baseDir);
  const resolvedPort = port ?? (await findFreePort());

  const proc = spawn(rigctldPath, ['-m', '1', '-t', String(resolvedPort)]);

  let stderr = '';
  proc.stderr?.on('data', (d) => (stderr += d.toString()));

  const exitPromise = new Promise<never>((_, reject) => {
    proc.once('exit', (code) => {
      reject(new Error(`rigctld exited early (code ${code}): ${stderr}`));
    });
  });

  await Promise.race([waitForPort(resolvedPort), exitPromise]);

  return {
    proc,
    port: resolvedPort,
    stop: () => stopProcess(proc),
  };
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

function waitForPort(port: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`rigctld did not open port ${port} within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 100);
        }
      });
    };
    attempt();
  });
}

function stopProcess(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    proc.once('exit', () => resolve());
    proc.kill('SIGTERM');
    // Fallback in case SIGTERM doesn't land (should be rare for rigctld).
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill('SIGKILL');
    }, 2000).unref();
  });
}
