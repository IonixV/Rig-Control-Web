import { useEffect } from "react";
import type { Socket } from "socket.io-client";

function ts(): string {
  const d = new Date();
  const p = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function formatArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

let capturing = false;

// Forwards this client's console.log/warn/error to the server so it lands in
// the same unified Diagnostics log as server-side output, regardless of
// whether this client is the Electron renderer or a remote browser tab.
// Installed once at app boot (called from App.tsx) so nothing logged before
// the Diagnostics tab is ever opened is lost.
export function useConsoleCapture(socket: Socket | null, clientId: string): void {
  useEffect(() => {
    if (!socket) return;

    const origin = window.electron?.isElectron ? "electron" : "browser";
    const tag = `[${origin} ${clientId.slice(0, 6)}]`;

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);

    const capture = (orig: (...a: any[]) => void, level: string) => (...args: any[]) => {
      orig(...args);
      if (capturing) return;
      capturing = true;
      try {
        const body = args.map(formatArg).join(" ");
        const line = `[${ts()}] ${tag}${level !== "LOG" ? ` [${level}]` : ""} ${body}`;
        socket.emit("client-console-log", line);
      } finally {
        capturing = false;
      }
    };

    console.log = capture(origLog, "LOG");
    console.warn = capture(origWarn, "WARN");
    console.error = capture(origError, "ERROR");

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    };
  }, [socket, clientId]);
}
