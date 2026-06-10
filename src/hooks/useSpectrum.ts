import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import type { SpectrumData, SpectrumSettings } from "../types";

const WATERFALL_MAX_LINES = 300;

export function useSpectrum(socket: Socket | null) {
  const [spectrumSupported, setSpectrumSupported] = useState(false);
  const [spectrumSettings, setSpectrumSettings] = useState<SpectrumSettings>({
    enabled: false,
    source: "hamlib",
    multicastAddr: "224.0.0.1",
    multicastPort: 4531,
    ft4222SpanIndex: 5,
  });

  const latestSpectrumRef = useRef<SpectrumData | null>(null);
  const waterfallHistoryRef = useRef<number[][]>([]);

  useEffect(() => {
    if (!socket) return;

    const onSpectrumData = (data: SpectrumData) => {
      latestSpectrumRef.current = data;
      waterfallHistoryRef.current = [
        data.amplitudes,
        ...waterfallHistoryRef.current,
      ].slice(0, WATERFALL_MAX_LINES);
    };

    const onSpectrumSupported = (val: boolean) => {
      setSpectrumSupported(val);
    };

    const onSettingsData = (data: any) => {
      if (data.spectrumSettings) {
        setSpectrumSettings((prev) => ({ ...prev, ...data.spectrumSettings }));
      }
    };

    socket.on("spectrum-data", onSpectrumData);
    socket.on("spectrum-supported", onSpectrumSupported);
    socket.on("settings-data", onSettingsData);

    return () => {
      socket.off("spectrum-data", onSpectrumData);
      socket.off("spectrum-supported", onSpectrumSupported);
      socket.off("settings-data", onSettingsData);
    };
  }, [socket]);

  return {
    spectrumSupported,
    spectrumEnabled: spectrumSettings.enabled,
    spectrumSettings,
    setSpectrumSettings,
    latestSpectrumRef,
    waterfallHistoryRef,
  };
}
