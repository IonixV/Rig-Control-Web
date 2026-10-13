import fs from "fs";
import path from "path";
import net from "net";

export const DEFAULT_PORT = 3000;
export type PortSource = "env" | "config" | "default";

// Persisted separately from settings.json: the port is needed before the HTTPS
// server (and, in Electron, the BrowserWindow) exists.
export function serverConfigPath(dataDir: string): string {
  return path.join(dataDir, "server-config.json");
}

export function parsePort(value: unknown, min = 1024): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  // UI-chosen ports default to >=1024 since lower ones need root/admin on most platforms
  return n >= min && n <= 65535 ? n : null;
}

export function resolvePort(dataDir: string, env: NodeJS.ProcessEnv = process.env): { port: number; source: PortSource } {
  const envPort = parsePort(env.RCW_PORT, 1);
  if (envPort !== null) return { port: envPort, source: "env" };
  try {
    const cfg = JSON.parse(fs.readFileSync(serverConfigPath(dataDir), "utf8"));
    const cfgPort = parsePort(cfg?.port);
    if (cfgPort !== null) return { port: cfgPort, source: "config" };
  } catch { /* missing or unreadable: use default */ }
  return { port: DEFAULT_PORT, source: "default" };
}

export function saveConfiguredPort(dataDir: string, port: number): void {
  fs.writeFileSync(serverConfigPath(dataDir), JSON.stringify({ port }, null, 2));
}

/** Resolves null if the port can be bound on all interfaces, else the error code. */
export function probePort(port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", (err: NodeJS.ErrnoException) => resolve(err.code ?? "UNKNOWN"));
    probe.listen(port, "0.0.0.0", () => probe.close(() => resolve(null)));
  });
}
