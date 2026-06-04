import dgram from "dgram";
import { ServerContext } from "./context.ts";

export function startSpectrumListener(ctx: ServerContext): void {
  if (ctx.spectrumSocket) {
    stopSpectrumListener(ctx);
  }

  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });

  sock.on("error", (err) => {
    console.error(`[SPECTRUM] UDP socket error: ${err.message}`);
    ctx.spectrumSocket = null;
  });

  sock.on("message", (msg) => {
    let packet: any;
    try {
      packet = JSON.parse(msg.toString("utf8"));
    } catch {
      return;
    }

    const hexData: string = packet.data || "";
    const amplitudes: number[] = [];
    for (let i = 0; i < hexData.length - 1; i += 2) {
      amplitudes.push(parseInt(hexData.slice(i, i + 2), 16));
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
      sock.addMembership(ctx.spectrumSettings.multicastAddr, iface);
      console.log(
        `[SPECTRUM] Listening on multicast ${ctx.spectrumSettings.multicastAddr}:${ctx.spectrumSettings.multicastPort}` +
          (iface ? ` (interface ${iface})` : ""),
      );
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
