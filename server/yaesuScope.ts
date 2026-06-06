import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { ServerContext } from "./context.ts";
import { vlogSpectrum } from "./vlog.ts";

const RESTART_DELAY_MS = 3000;

export function getYaesuScopeHelperPath(baseDir: string): string {
  let platformDir: string;
  let binaryName: string;
  if (process.platform === "win32") {
    platformDir = "windows";
    binaryName = "ft4222-scope-reader.exe";
  } else if (process.platform === "darwin") {
    platformDir = "mac";
    binaryName = "ft4222-scope-reader";
  } else {
    platformDir = "linux";
    binaryName = "ft4222-scope-reader";
  }

  let binBase = baseDir;
  if (binBase.endsWith(".asar")) binBase = binBase.replace(".asar", ".asar.unpacked");

  const fullPath = path.join(binBase, "bin", platformDir, binaryName);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[YAESU-SCOPE] binary not found at ${fullPath} — run 'npm run build:ft4222-reader'`);
  }
  return fullPath;
}

export function startYaesuScope(ctx: ServerContext): void {
  if (ctx.yaesuScopeProcess && !ctx.yaesuScopeProcess.killed) {
    return;
  }

  const binaryPath = getYaesuScopeHelperPath(ctx.baseDir);
  console.log(`[YAESU-SCOPE] Starting ${binaryPath}`);

  let proc: ReturnType<typeof spawn>;
  try {
    proc = spawn(binaryPath, [], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (err: any) {
    console.error(`[YAESU-SCOPE] Failed to spawn: ${err.message}`);
    ctx.yaesuScopeProcess = null;
    return;
  }

  ctx.yaesuScopeProcess = proc;

  let started = false;
  let lineBuffer = "";

  proc.stdout!.setEncoding("utf8");
  proc.stdout!.on("data", (chunk: string) => {
    lineBuffer += chunk;
    let newline: number;
    while ((newline = lineBuffer.indexOf("\n")) !== -1) {
      const line = lineBuffer.slice(0, newline).trim();
      lineBuffer = lineBuffer.slice(newline + 1);
      if (!line) continue;

      if (!started) {
        if (line.startsWith("OPEN_OK")) {
          started = true;
          console.log("[YAESU-SCOPE] Device opened, receiving spectrum data");
          ctx.io.emit("yaesu-scope-status", { running: true, error: null });
        } else if (line.startsWith("OPEN_ERROR:")) {
          const msg = line.slice("OPEN_ERROR:".length).trim();
          console.error(`[YAESU-SCOPE] ${msg}`);
          ctx.io.emit("yaesu-scope-status", { running: false, error: msg });
        }
        continue;
      }

      /* Parse NDJSON frame */
      let frame: any;
      try {
        frame = JSON.parse(line);
      } catch {
        vlogSpectrum(`[YAESU-SCOPE] Bad JSON: ${line.slice(0, 80)}`);
        continue;
      }

      const wf1Hex: string = frame.wf1 ?? "";
      if (wf1Hex.length !== 1700) {
        vlogSpectrum(`[YAESU-SCOPE] Unexpected wf1 length ${wf1Hex.length}`);
        continue;
      }

      const amplitudes: number[] = new Array(850);
      for (let i = 0; i < 850; i++) {
        amplitudes[i] = parseInt(wf1Hex.slice(i * 2, i * 2 + 2), 16);
      }

      const centerHz: number = frame.centerHz ?? 0;
      const spanHz:   number = frame.spanHz   ?? 0;
      const lowHz:    number = frame.lowHz    ?? 0;
      const highHz:   number = frame.highHz   ?? 0;
      const modeVariant: number = frame.modeVariant ?? 0;

      vlogSpectrum(`[YAESU-SCOPE] frame: span=${spanHz}Hz center=${centerHz}Hz mode=${modeVariant}`);

      ctx.io.emit("spectrum-data", {
        id: 0,
        name: "FT-710",
        type: modeVariant === 2 ? "FIXED" : "CENTER",
        length: amplitudes.length,
        amplitudes,
        minLevel: -130,
        maxLevel: -20,
        centerFreq: centerHz,
        span: spanHz,
        lowFreq: lowHz,
        highFreq: highHz,
        timestamp: Date.now(),
      });
    }
  });

  proc.stderr!.setEncoding("utf8");
  proc.stderr!.on("data", (data: string) => {
    vlogSpectrum(`[YAESU-SCOPE] stderr: ${data.trim()}`);
  });

  proc.on("close", (code) => {
    console.log(`[YAESU-SCOPE] Process exited (code=${code})`);
    ctx.yaesuScopeProcess = null;
    ctx.io.emit("yaesu-scope-status", { running: false, error: null });

    /* Auto-restart if spectrum is still enabled and source is still ft4222 */
    if (ctx.spectrumSettings.enabled && ctx.spectrumSettings.source === "ft4222") {
      console.log(`[YAESU-SCOPE] Restarting in ${RESTART_DELAY_MS}ms`);
      setTimeout(() => {
        if (ctx.spectrumSettings.enabled && ctx.spectrumSettings.source === "ft4222") {
          startYaesuScope(ctx);
        }
      }, RESTART_DELAY_MS);
    }
  });

  proc.on("error", (err) => {
    console.error(`[YAESU-SCOPE] Process error: ${err.message}`);
    ctx.yaesuScopeProcess = null;
  });
}

export function stopYaesuScope(ctx: ServerContext): void {
  if (ctx.yaesuScopeProcess && !ctx.yaesuScopeProcess.killed) {
    console.log("[YAESU-SCOPE] Stopping");
    ctx.yaesuScopeProcess.kill("SIGTERM");
    ctx.yaesuScopeProcess = null;
  }
  ctx.io.emit("yaesu-scope-status", { running: false, error: null });
}
