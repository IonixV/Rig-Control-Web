import { useState, useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { RigStatus } from "../types";

let wsjtxVerbose = false;
const vlog = (...args: any[]) => { if (wsjtxVerbose) console.log("[wsjtx:bridge]", ...args); };

interface UseWsjtxBridgeOptions {
  socket: Socket | null;
  rigStatus: RigStatus;
}

export function useWsjtxBridge({ socket, rigStatus }: UseWsjtxBridgeOptions) {
  const [bridgeEnabled, setBridgeEnabled] = useState(() =>
    localStorage.getItem("wsjtx-bridge-enabled") === "true"
  );
  const [wsPort, setWsPort] = useState(() =>
    parseInt(localStorage.getItem("wsjtx-bridge-ws-port") || "4541")
  );
  const [bridgeConnected, setBridgeConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rigStatusRef = useRef(rigStatus);
  const socketRef = useRef(socket);
  const enabledRef = useRef(bridgeEnabled);

  rigStatusRef.current = rigStatus;
  socketRef.current = socket;
  enabledRef.current = bridgeEnabled;

  // Pick up --debug-wsjtx flag from server
  useEffect(() => {
    if (!socket) return;
    const onDebugFlags = ({ wsjtx }: { wsjtx: boolean }) => {
      wsjtxVerbose = wsjtx;
      if (wsjtx) vlog("Debug logging enabled via server --debug-wsjtx flag");
    };
    socket.on("debug-flags", onDebugFlags);
    return () => { socket.off("debug-flags", onDebugFlags); };
  }, [socket]);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    const url = `ws://localhost:${wsPort}`;
    vlog(`Connecting to helper at ${url}`);
    try {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        vlog("WebSocket connected to helper");
        setBridgeConnected(true);
        const s = rigStatusRef.current;
        const statusMsg = {
          event: "rig-status",
          data: {
            frequency: s.frequency,
            mode: s.mode,
            bandwidth: s.bandwidth,
            ptt: s.ptt,
            vfo: s.vfo,
            isSplit: s.isSplit,
            txVFO: s.txVFO,
          },
        };
        vlog("Pushing initial rig status:", statusMsg.data);
        ws.send(JSON.stringify(statusMsg));
      };

      ws.onclose = () => {
        vlog("WebSocket disconnected from helper");
        setBridgeConnected(false);
        wsRef.current = null;
        if (enabledRef.current) {
          vlog("Scheduling reconnect in 3s");
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (enabledRef.current) connect();
          }, 3000);
        }
      };

      ws.onerror = (e) => {
        vlog("WebSocket error:", e);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          vlog("Received from helper:", msg);
          if (msg.cmd && socketRef.current) {
            handleCommand(ws, socketRef.current, msg);
          }
        } catch (e) {
          vlog("Failed to parse message from helper:", e);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      vlog("WebSocket connection failed:", e);
      if (enabledRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (enabledRef.current) connect();
        }, 3000);
      }
    }
  }, [wsPort]);

  const disconnect = useCallback(() => {
    vlog("Disconnecting from helper");
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setBridgeConnected(false);
  }, []);

  // Connect/disconnect when enabled changes
  useEffect(() => {
    if (bridgeEnabled) {
      vlog("Bridge enabled, initiating connection");
      connect();
    } else {
      vlog("Bridge disabled");
      disconnect();
    }
    return () => disconnect();
  }, [bridgeEnabled, connect, disconnect]);

  // Forward rig-status updates to the helper
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const data = {
      frequency: rigStatus.frequency,
      mode: rigStatus.mode,
      bandwidth: rigStatus.bandwidth,
      ptt: rigStatus.ptt,
      vfo: rigStatus.vfo,
      isSplit: rigStatus.isSplit,
      txVFO: rigStatus.txVFO,
    };
    vlog("Forwarding rig-status to helper:", data);
    ws.send(JSON.stringify({ event: "rig-status", data }));
  }, [
    rigStatus.frequency, rigStatus.mode, rigStatus.bandwidth,
    rigStatus.ptt, rigStatus.vfo, rigStatus.isSplit, rigStatus.txVFO,
  ]);

  // Persist settings
  const updateEnabled = useCallback((enabled: boolean) => {
    setBridgeEnabled(enabled);
    localStorage.setItem("wsjtx-bridge-enabled", String(enabled));
  }, []);

  const updateWsPort = useCallback((port: number) => {
    setWsPort(port);
    localStorage.setItem("wsjtx-bridge-ws-port", String(port));
  }, []);

  return {
    bridgeEnabled,
    setBridgeEnabled: updateEnabled,
    wsPort,
    setWsPort: updateWsPort,
    bridgeConnected,
  };
}

function handleCommand(ws: WebSocket, socket: Socket, msg: { cmd: string; args: any; id: number }) {
  const { cmd, args, id } = msg;
  const t0 = performance.now();

  const sendResult = (ok: boolean, error?: string) => {
    const elapsed = (performance.now() - t0).toFixed(1);
    vlog(`Sending cmd-result id=${id} ok=${ok} (${elapsed}ms since receipt)`, error ? `error=${error}` : "");
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "cmd-result", id, ok, ...(error ? { error } : {}) }));
    }
  };

  vlog(`Handling command: ${cmd}`, args);

  switch (cmd) {
    case "set-frequency":
      vlog(`Emitting set-frequency ${args} via Socket.io`);
      socket.emit("set-frequency", String(args));
      sendResult(true);
      break;

    case "set-mode":
      if (typeof args === "object" && args.mode) {
        vlog(`Emitting set-mode ${args.mode} bw=${args.bandwidth} via Socket.io`);
        socket.emit("set-mode", { mode: args.mode, bandwidth: args.bandwidth || "-1" });
        sendResult(true);
      } else {
        sendResult(false, "invalid args");
      }
      break;

    case "set-ptt": {
      const pttVal = Number(args) > 0;
      vlog(`PTT: emitting set-ptt ${pttVal} via Socket.io`);
      const pttErrorHandler = (errMsg: string) => {
        vlog(`PTT: rig-error received from server: "${errMsg}"`);
      };
      socket.once("rig-error", pttErrorHandler);
      const pttStatusHandler = (status: any) => {
        const elapsed = (performance.now() - t0).toFixed(1);
        vlog(`PTT: rig-status confirmation received (${elapsed}ms): ptt=${status.ptt}, requested=${pttVal}, match=${status.ptt === pttVal}`);
        socket.off("rig-error", pttErrorHandler);
      };
      socket.once("rig-status", pttStatusHandler);
      setTimeout(() => {
        socket.off("rig-status", pttStatusHandler);
        socket.off("rig-error", pttErrorHandler);
      }, 10000);
      socket.emit("set-ptt", pttVal);
      sendResult(true);
      break;
    }

    case "set-vfo":
      vlog(`Emitting set-vfo ${args} via Socket.io`);
      socket.emit("set-vfo", String(args));
      sendResult(true);
      break;

    case "set-split-vfo":
      if (typeof args === "object") {
        vlog(`Emitting set-split-vfo split=${args.split} vfo=${args.vfo} via Socket.io`);
        socket.emit("set-split-vfo", {
          split: args.split ? 1 : 0,
          txVFO: args.vfo || "VFOB",
        });
        sendResult(true);
      } else {
        sendResult(false, "invalid args");
      }
      break;

    case "send-raw":
      vlog(`Emitting send-raw "${args}" via Socket.io`);
      socket.emit("send-raw", String(args));
      sendResult(true);
      break;

    default:
      vlog(`Unknown command: ${cmd}`);
      sendResult(false, "unknown command");
  }
}
