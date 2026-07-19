import net from 'net';

/**
 * A minimal TCP client standing in for a real WSJT-X instance, speaking the
 * subset of the Hamlib rigctld-extended protocol wsjtx-bridge.c actually
 * implements against its TCP port. Unlike a one-shot request/response probe,
 * this keeps the connection open across a single command's full round trip —
 * required for SET commands (F/M/T/V/S), whose response is written back
 * asynchronously on the *same* TCP connection once the browser's WebSocket
 * side replies (wsjtx-bridge.c's pending_cmd_t tracks the originating
 * tcp_sock, not just a fire-and-forget write). GET commands (f/m/t/v/s/
 * dump_state/...) respond synchronously from the bridge's own cache.
 *
 * No `+` prefix is required (the bridge strips one if present but always
 * responds in the same fixed single-line format either way — confirmed by
 * reading wsjtx-bridge.c's handle_rigctld_cmd), so commands are sent as-is.
 */
export class SyntheticWsjtxClient {
  private socket: net.Socket | null = null;
  private buffer = '';
  // Lines that arrived before a matching readLine() call claimed them — a
  // multi-line response (e.g. dump_state's ~30 lines) typically arrives in
  // one TCP chunk/data event, all at once, well before the caller has had a
  // chance to await readLine() for each one individually.
  private pendingLines: string[] = [];
  private waiters: ((line: string) => void)[] = [];

  connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
        this.socket = socket;
        resolve();
      });
      socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.drainLines();
      });
      socket.on('error', reject);
    });
  }

  private drainLines(): void {
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, '');
      this.buffer = this.buffer.slice(nl + 1);
      const waiter = this.waiters.shift();
      if (waiter) waiter(line);
      else this.pendingLines.push(line);
    }
  }

  /** Reads the next line-terminated response, whenever it arrives. */
  readLine(timeoutMs = 5000): Promise<string> {
    const buffered = this.pendingLines.shift();
    if (buffered !== undefined) return Promise.resolve(buffered);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(onLine);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`No response within ${timeoutMs}ms`));
      }, timeoutMs);
      const onLine = (line: string) => {
        clearTimeout(timer);
        resolve(line);
      };
      this.waiters.push(onLine);
    });
  }

  send(cmd: string): void {
    if (!this.socket) throw new Error('Not connected');
    this.socket.write(cmd + '\n');
  }

  /** Multi-line commands (dump_state, dump_caps) terminate with "done". */
  async readUntilDone(timeoutMs = 5000): Promise<string> {
    const lines: string[] = [];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`No "done" terminator within ${timeoutMs}ms`);
      const line = await this.readLine(remaining);
      lines.push(line);
      if (line.trim() === 'done') break;
    }
    return lines.join('\n');
  }

  close(): void {
    this.socket?.end();
    this.socket = null;
  }
}
