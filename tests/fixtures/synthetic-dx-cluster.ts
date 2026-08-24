import net from 'net';

export interface SyntheticDxCluster {
  port: number;
  /** Sends a raw line (CRLF-terminated) to every currently-connected client —
   *  used to push synthetic "DX de ..." spot lines. */
  sendLine(line: string): void;
  stop(): Promise<void>;
}

/**
 * A minimal TCP server speaking just enough of the classic DXSpider/AR-
 * Cluster telnet handshake for server/dxCluster.ts's client to exercise its
 * real code path end-to-end: send a "login:" prompt, accept (and ignore) any
 * callsign line, then let the test push scripted spot lines on demand. Stands
 * in for a real cluster node the same way tests/fixtures/rigctld-dummy.ts
 * stands in for real rig hardware and tests/fixtures/synthetic-udp.ts stands
 * in for a real Hamlib spectrum feed.
 */
export function startSyntheticDxCluster(): Promise<SyntheticDxCluster> {
  return new Promise((resolve, reject) => {
    const clients = new Set<net.Socket>();

    const server = net.createServer((socket) => {
      clients.add(socket);
      socket.write('login: ');
      socket.on('close', () => clients.delete(socket));
      socket.on('error', () => clients.delete(socket));
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        sendLine(line: string) {
          const withCrlf = line.endsWith('\r\n') ? line : `${line}\r\n`;
          for (const c of clients) c.write(withCrlf);
        },
        stop() {
          return new Promise<void>((res) => {
            for (const c of clients) c.destroy();
            server.close(() => res());
          });
        },
      });
    });
  });
}
