import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { Socket } from "socket.io";
import { vlogInfra as vlog } from "./vlog.ts";

export interface SerialPortInfo {
  path: string;
  label: string;
}

// Sorts by trailing numeric suffix so e.g. ttyUSB2 < ttyUSB10 and COM3 < COM10
// instead of lexicographic order.
export function naturalSortByTrailingNumber(a: string, b: string): number {
  const numA = parseInt(a.match(/(\d+)$/)?.[1] ?? "0", 10);
  const numB = parseInt(b.match(/(\d+)$/)?.[1] ?? "0", 10);
  if (numA !== numB) return numA - numB;
  return a.localeCompare(b);
}

const LINUX_TTY_PATTERN = /^(ttyUSB|ttyACM|ttyS)(\d+)$/;

export function classifyLinuxDeviceName(name: string): boolean {
  return LINUX_TTY_PATTERN.test(name);
}

// The serial8250 driver reserves ~32 ttyS* device nodes on most x86 systems
// whether or not real UART hardware backs them, and (unlike sysfs, which
// looks identical for phantom and real ports here) there is no reliable way
// to tell them apart without root: /proc/tty/driver/serial lists each port's
// detected UART type ("uart:16550A" vs "uart:unknown" for a phantom one),
// but that file is commonly unreadable to a non-root process — verified
// Permission denied for a normal user account here, and it's the same class
// of restriction as /proc/asound getting masked in containers (see the
// docker/podman audio note elsewhere in this codebase). When it can't be
// read, fall back to only the classic COM1-4-equivalent range (ttyS0-3);
// higher-numbered ttyS* are essentially always phantom serial8250
// reservations on real-world x86 hardware.
const LINUX_TTYS_FALLBACK_MAX = 3;

export function parseProcTtyDriverSerial(text: string): Set<string> {
  const real = new Set<string>();
  for (const line of text.split("\n")) {
    const m = line.match(/^(\d+):\s+uart:(\S+)/);
    if (m && m[2] !== "unknown") real.add(`ttyS${m[1]}`);
  }
  return real;
}

export function shouldIncludeTtyS(name: string, realBacked: Set<string> | null): boolean {
  if (realBacked) return realBacked.has(name);
  const num = parseInt(name.slice("ttyS".length), 10);
  return num <= LINUX_TTYS_FALLBACK_MAX;
}

// USB-attached devices (which get a friendly, stable /dev/serial/by-id/*
// name when one resolves) always sort before generic/legacy ttyS* ports —
// otherwise natural-sort-by-trailing-number interleaves them (ttyS0,
// ttyUSB0, ttyS1, ttyUSB1, ...) since ttyS0 and ttyUSB0 tie on "0" and only
// then fall back to alphabetical.
export function orderLinuxDeviceNames(names: string[]): string[] {
  const usbLike = names
    .filter((n) => n.startsWith("ttyUSB") || n.startsWith("ttyACM"))
    .sort(naturalSortByTrailingNumber);
  const generic = names.filter((n) => n.startsWith("ttyS")).sort(naturalSortByTrailingNumber);
  return [...usbLike, ...generic];
}

async function readRealBackedTtyS(): Promise<Set<string> | null> {
  const text = await fs.promises.readFile("/proc/tty/driver/serial", "utf-8").catch(() => null);
  return text === null ? null : parseProcTtyDriverSerial(text);
}

// Parses `reg query "HKLM\HARDWARE\DEVICEMAP\SERIALCOMM"` stdout, e.g.:
//   HKEY_LOCAL_MACHINE\HARDWARE\DEVICEMAP\SERIALCOMM
//       \Device\VCP0    REG_SZ    COM3
//       \Device\Serial0    REG_SZ    COM1
// into a sorted list of COM port names.
export function parseWindowsSerialCommRegistry(output: string): string[] {
  const ports: string[] = [];
  const lineRe = /REG_SZ\s+(COM\d+)\s*$/;
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (m) ports.push(m[1]);
  }
  return ports.sort(naturalSortByTrailingNumber);
}

async function listLinuxSerialPorts(): Promise<SerialPortInfo[]> {
  const devEntries = await fs.promises.readdir("/dev").catch(() => [] as string[]);
  const candidates = devEntries.filter(classifyLinuxDeviceName);

  // ttyUSB*/ttyACM* nodes only ever exist when a device is actually plugged
  // in, so they're always included as-is; ttyS* needs the real/phantom
  // filter described above readRealBackedTtyS().
  const realBackedTtyS = await readRealBackedTtyS();
  const filtered = orderLinuxDeviceNames(
    candidates.filter((name) => !name.startsWith("ttyS") || shouldIncludeTtyS(name, realBackedTtyS))
  );

  // Prefer stable /dev/serial/by-id/* symlinks over the raw device node
  // they resolve to, since ttyUSB/ttyACM numbering can shift across
  // reboots/replugs.
  const byIdDir = "/dev/serial/by-id";
  const byIdEntries = await fs.promises.readdir(byIdDir).catch(() => [] as string[]);
  const realPathToById = new Map<string, string>();
  for (const entry of byIdEntries) {
    const full = path.join(byIdDir, entry);
    const real = await fs.promises.realpath(full).catch(() => null);
    if (real) realPathToById.set(real, full);
  }

  return filtered.map((name) => {
    const devPath = `/dev/${name}`;
    const byId = realPathToById.get(devPath);
    if (byId) {
      return { path: byId, label: `${path.basename(byId)} (${name})` };
    }
    return { path: devPath, label: devPath };
  });
}

async function listMacSerialPorts(): Promise<SerialPortInfo[]> {
  const devEntries = await fs.promises.readdir("/dev").catch(() => [] as string[]);
  return devEntries
    .filter((name) => name.startsWith("cu.") && name !== "cu.Bluetooth-Incoming-Port")
    .sort()
    .map((name) => ({ path: `/dev/${name}`, label: `/dev/${name}` }));
}

function listWindowsSerialPorts(): Promise<SerialPortInfo[]> {
  return new Promise((resolve) => {
    exec('reg query "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM"', (err, stdout) => {
      // A non-zero exit means the registry key doesn't exist, i.e. no
      // serial ports currently attached — not an error condition.
      if (err || !stdout) {
        resolve([]);
        return;
      }
      const ports = parseWindowsSerialCommRegistry(stdout);
      resolve(ports.map((p) => ({ path: p, label: p })));
    });
  });
}

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  if (process.platform === "win32") return listWindowsSerialPorts();
  if (process.platform === "darwin") return listMacSerialPorts();
  return listLinuxSerialPorts();
}

export function registerSerialHandlers(socket: Socket): void {
  socket.on("get-serial-ports", async () => {
    vlog("[SERIAL] Client requested serial port list");
    try {
      const ports = await listSerialPorts();
      socket.emit("serial-ports-list", ports);
    } catch (e: any) {
      vlog("[SERIAL] Enumeration failed:", e?.message || e);
      socket.emit("serial-ports-list", []);
    }
  });
}
