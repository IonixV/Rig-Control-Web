import { Socket } from "socket.io";
import type { ServerContext } from "./context.ts";
import { ts, debugFlags, setDebugFlag, type DebugFlags } from "./vlog.ts";

// Rolling window: entries older than this are dropped regardless of count,
// so a quiet debug session doesn't accumulate unbounded history and the
// buffer always reflects "the last 10 minutes" rather than an arbitrary
// span that shrinks to seconds under a chatty flag. MAX_LINES is a burst
// safety net on top of that — bounds worst-case memory if something logs
// an extreme volume within the window itself.
const MAX_AGE_MS = 10 * 60 * 1000;
const MAX_LINES = 5000;
const MAX_CLIENT_LINE_LENGTH = 4000;

// Matches the exact "[HH:MM:SS.mmm]" prefix produced by vlog.ts's ts(), and
// nothing else — a plain bracket tag like "[AUDIO-INIT]" or "[CW]" must NOT
// match, or lines using that tag would wrongly be treated as pre-timestamped
// and skip having a real timestamp added.
const TIMESTAMP_RE = /^\[\d{2}:\d{2}:\d{2}\.\d{3}\]/;

// Drops entries older than MAX_AGE_MS, then enforces MAX_LINES as a hard
// cap. diagnosticsLogTimestamps is kept index-aligned with diagnosticsLog
// throughout — always mutate both together.
function pruneDiagnosticsLog(ctx: ServerContext): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  let dropCount = 0;
  while (dropCount < ctx.diagnosticsLogTimestamps.length && ctx.diagnosticsLogTimestamps[dropCount] < cutoff) {
    dropCount++;
  }
  const overflow = Math.max(0, ctx.diagnosticsLog.length - MAX_LINES);
  dropCount = Math.max(dropCount, overflow);
  if (dropCount > 0) {
    ctx.diagnosticsLog.splice(0, dropCount);
    ctx.diagnosticsLogTimestamps.splice(0, dropCount);
  }
}

// Every line that enters the diagnostics buffer passes through here, so this
// is the single place that guarantees a timestamp — regardless of whether
// the line already carries one (vlog* output, or a manually-embedded ts()
// call e.g. server/rigComm.ts) or needs one added (plain console.* calls,
// or lines forwarded from a client via client-console-log).
export function pushDiagnosticsLine(ctx: ServerContext, line: string): void {
  const stamped = TIMESTAMP_RE.test(line) ? line : `[${ts()}] ${line}`;
  ctx.diagnosticsLog.push(stamped);
  ctx.diagnosticsLogTimestamps.push(Date.now());
  pruneDiagnosticsLog(ctx);
  ctx.io.emit("diagnostics-log", [stamped]);
}

// Wraps console.log/warn/error once at startup so every diagnostic line —
// vlog* subsystem output as well as plain console usage elsewhere in the
// codebase — is captured into a single buffer/stream, mirroring what a user
// would see in the terminal. Re-entrancy guarded since pushDiagnosticsLine
// itself can trigger further console/socket activity (e.g. Socket.io
// internals) that must not recurse back into the wrapper.
export function initDiagnosticsLog(ctx: ServerContext): void {
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  let capturing = false;
  const capture = (orig: (...a: any[]) => void, level: string) => (...args: any[]) => {
    orig(...args);
    if (capturing) return;
    capturing = true;
    try {
      const body = args.map(formatArg).join(" ");
      // Insert the level tag right after an existing timestamp if the call
      // already embeds one (e.g. server/rigComm.ts's `${ts()}` usage),
      // rather than prepending it and defeating pushDiagnosticsLine's
      // timestamp check, which would otherwise add a second one.
      let line = body;
      if (level !== "LOG") {
        const m = body.match(TIMESTAMP_RE);
        line = m ? `${m[0]} [${level}]${body.slice(m[0].length)}` : `[${level}] ${body}`;
      }
      pushDiagnosticsLine(ctx, line);
    } finally {
      capturing = false;
    }
  };

  console.log = capture(origLog, "LOG");
  console.warn = capture(origWarn, "WARN");
  console.error = capture(origError, "ERROR");
}

function formatArg(value: any): string {
  if (typeof value === "string") return value;
  // JSON.stringify(Error) yields "{}" — name/message/stack are non-enumerable
  // — so most `console.error("...", err)` calls would otherwise lose the
  // actual error detail in the captured log line.
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function registerDiagnosticsHandlers(socket: Socket, ctx: ServerContext): void {
  socket.on("get-diagnostics-log", () => {
    pruneDiagnosticsLog(ctx);
    socket.emit("diagnostics-log-snapshot", ctx.diagnosticsLog);
    // The connect-time "debug-flags" emit (server.ts) fires before the
    // lazily-mounted Diagnostics tab exists to receive it, so re-send
    // current flag state here too, on tab-open.
    socket.emit("debug-flags", debugFlags);
  });

  socket.on("set-debug-flag", ({ key, value }: { key: keyof DebugFlags; value: boolean }) => {
    if (!(key in debugFlags)) return;
    setDebugFlag(key, !!value);
    ctx.saveSettings();
    ctx.io.emit("debug-flags", debugFlags);
  });

  socket.on("client-console-log", (line: string) => {
    if (typeof line !== "string" || !line.trim()) return;
    pushDiagnosticsLine(ctx, line.slice(0, MAX_CLIENT_LINE_LENGTH));
  });
}
