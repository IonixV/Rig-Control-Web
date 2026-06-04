import dgram from "dgram";
import { ServerContext } from "./context.ts";
import { vlogSpectrum } from "./vlog.ts";

let packetCount = 0;
let lastLogTime = 0;

export function startSpectrumListener(ctx: ServerContext): void {
  if (ctx.spectrumSocket) {
    stopSpectrumListener(ctx);
  }

  packetCount = 0;
  lastLogTime = 0;

  vlogSpectrum(`[SPECTRUM] Creating UDP socket (clientHost=${ctx.clientHost})`);
  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });

  sock.on("error", (err) => {
    console.error(`[SPECTRUM] UDP socket error: ${err.message}`);
    ctx.spectrumSocket = null;
  });

  sock.on("message", (msg, rinfo) => {
    vlogSpectrum(`[SPECTRUM] UDP packet received: ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);

    let packet: any;
    try {
      packet = JSON.parse(msg.toString("utf8"));
      vlogSpectrum(`[SPECTRUM] JSON parsed OK: app=${packet.app} seq=${packet.seq} dataLen=${(packet.data ?? "").length} type=${packet.type}`);
    } catch (e: any) {
      console.error(`[SPECTRUM] JSON parse failed: ${e.message}`);
      vlogSpectrum(`[SPECTRUM] Raw message (first 200 bytes): ${msg.toString("utf8").slice(0, 200)}`);
      return;
    }

    const hexData: string = packet.data || "";
    const amplitudes: number[] = [];
    for (let i = 0; i < hexData.length - 1; i += 2) {
      amplitudes.push(parseInt(hexData.slice(i, i + 2), 16));
    }
    vlogSpectrum(`[SPECTRUM] Decoded ${amplitudes.length} amplitude points`);

    const clientCount = ctx.io.sockets.sockets.size;
    vlogSpectrum(`[SPECTRUM] Emitting spectrum-data to ${clientCount} client(s)`);

    packetCount++;
    const now = Date.now();
    if (now - lastLogTime >= 10_000) {
      console.log(`[SPECTRUM] ${packetCount} packets received in last 10s (${amplitudes.length} points each)`);
      packetCount = 0;
      lastLogTime = now;
    }

    ctx.io.emit("spectrum-data", {
      id: packet.id ?? 0,
      name: packet.name ?? "",
      type: packet.type ?? "CENTER",
      length: packet.length ?? amplitudes.length,
      amplitudes,
      minLevel: packet.minLevel ?? 0,
      maxLevel: packet.maxLevel ?? 255,
      centerFreq: packet.centerFreq ?? 0,
      span: packet.span ?? 0,
      lowFreq: packet.lowFreq ?? 0,
      highFreq: packet.highFreq ?? 0,
      timestamp: Date.now(),
    });
  });

  sock.bind(ctx.spectrumSettings.multicastPort, () => {
    try {
      const iface =
        ctx.clientHost && ctx.clientHost !== "127.0.0.1" && ctx.clientHost !== "localhost"
          ? ctx.clientHost
          : undefined;
      vlogSpectrum(`[SPECTRUM] Joining multicast group ${ctx.spectrumSettings.multicastAddr} on interface ${iface ?? "(OS default)"}`);
      sock.addMembership(ctx.spectrumSettings.multicastAddr, iface);
      const addr = sock.address();
      console.log(
        `[SPECTRUM] Listening on multicast ${ctx.spectrumSettings.multicastAddr}:${ctx.spectrumSettings.multicastPort}` +
          (iface ? ` (interface ${iface})` : ""),
      );
      vlogSpectrum(`[SPECTRUM] Socket bound to ${addr.address}:${addr.port} family=${addr.family}`);
    } catch (err: any) {
      console.error(`[SPECTRUM] Failed to join multicast group: ${err.message}`);
    }
  });

  ctx.spectrumSocket = sock;
}

export function stopSpectrumListener(ctx: ServerContext): void {
  if (ctx.spectrumSocket) {
    try {
      ctx.spectrumSocket.close();
    } catch {
      // already closed
    }
    ctx.spectrumSocket = null;
    console.log("[SPECTRUM] Listener stopped");
  }
}
