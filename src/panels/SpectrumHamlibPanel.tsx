import React, { useRef, useEffect, useState, useCallback } from "react";
import { Activity } from "lucide-react";
import PanelChrome from "../components/PanelChrome";
import type { SpectrumData } from "../types";
import { COLORMAPS, COLORMAP_NAMES, amplitudeToPixel } from "../utils/spectrumColors";

const DEFAULT_HEIGHT = 350;
const SPECTRUM_RATIO = 0.3;
const FLOOR_DEFAULT = -130;
const CEILING_DEFAULT = -40;

interface Props {
  latestSpectrumRef: React.MutableRefObject<SpectrumData | null>;
  waterfallHistoryRef: React.MutableRefObject<number[][]>;
  spectrumSupported: boolean;
  spectrumEnabled: boolean;
  connected: boolean;
  handleSetFreq: (freq: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  heightPx?: number;
}

export default function SpectrumHamlibPanel({
  latestSpectrumRef,
  waterfallHistoryRef,
  spectrumSupported,
  spectrumEnabled,
  connected,
  handleSetFreq,
  isCollapsed,
  setIsCollapsed,
  heightPx = DEFAULT_HEIGHT,
}: Props) {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastDrawnTimestampRef = useRef<number>(0);

  const [colorMapId, setColorMapId] = useState("classic");
  const [floor, setFloor] = useState(FLOOR_DEFAULT);
  const [ceiling, setCeiling] = useState(CEILING_DEFAULT);

  const spectrumHeight = Math.floor(heightPx * SPECTRUM_RATIO);
  const waterfallHeight = heightPx - spectrumHeight - 20; // 20px for freq axis

  const freqLabel = useCallback((hz: number): string => {
    if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
    if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
    return `${hz} Hz`;
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const data = latestSpectrumRef.current;
    if (!data || !data.highFreq || !data.lowFreq) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hz = Math.round(data.lowFreq + (x / rect.width) * (data.highFreq - data.lowFreq));
    handleSetFreq(String(hz));
  }, [latestSpectrumRef, handleSetFreq]);

  useEffect(() => {
    if (isCollapsed) return;

    const colorMap = COLORMAPS[colorMapId] ?? COLORMAPS.classic;

    const draw = () => {
      const data = latestSpectrumRef.current;
      const specCanvas = spectrumCanvasRef.current;
      const wfCanvas = waterfallCanvasRef.current;
      if (!specCanvas || !wfCanvas) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const w = specCanvas.width;

      if (!data || data.amplitudes.length === 0 || !connected || !spectrumEnabled) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      if (data.timestamp === lastDrawnTimestampRef.current) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDrawnTimestampRef.current = data.timestamp;

      const ampRange = data.maxLevel - data.minLevel || 1;

      // --- Spectrum line ---
      const sCtx = specCanvas.getContext("2d");
      if (sCtx) {
        const sh = specCanvas.height;
        sCtx.clearRect(0, 0, w, sh);

        // Grid lines
        sCtx.strokeStyle = "rgba(255,255,255,0.08)";
        sCtx.lineWidth = 1;
        for (let db = Math.ceil(floor / 10) * 10; db <= ceiling; db += 10) {
          const y = sh - ((db - floor) / (ceiling - floor)) * sh;
          sCtx.beginPath();
          sCtx.moveTo(0, y);
          sCtx.lineTo(w, y);
          sCtx.stroke();
        }

        sCtx.beginPath();
        sCtx.strokeStyle = "#22c55e";
        sCtx.fillStyle = "rgba(34,197,94,0.25)";
        sCtx.lineWidth = 1.5;

        const step = w / data.amplitudes.length;
        for (let i = 0; i < data.amplitudes.length; i++) {
          const dbm = data.minLevel + (data.amplitudes[i] / 255) * ampRange;
          const norm = Math.max(0, Math.min(1, (dbm - floor) / (ceiling - floor)));
          const x = i * step;
          const y = sh - norm * sh;
          if (i === 0) {
            sCtx.moveTo(x, sh);
            sCtx.lineTo(x, y);
          } else {
            sCtx.lineTo(x, y);
          }
        }
        sCtx.lineTo(w, sh);
        sCtx.closePath();
        sCtx.fill();
        sCtx.stroke();
      }

      // --- Waterfall ---
      const wfCtx = wfCanvas.getContext("2d");
      if (wfCtx) {
        const wh = wfCanvas.height;
        const lines = waterfallHistoryRef.current;
        const visibleLines = Math.min(lines.length, wh);
        const imageData = wfCtx.createImageData(w, wh);
        const buf32 = new Uint32Array(imageData.data.buffer);

        for (let row = 0; row < visibleLines; row++) {
          const line = lines[row];
          const step = line.length / w;
          for (let col = 0; col < w; col++) {
            const ampIdx = Math.min(line.length - 1, Math.floor(col * step));
            const dbm = data.minLevel + (line[ampIdx] / 255) * ampRange;
            const norm = Math.max(0, Math.min(1, (dbm - floor) / (ceiling - floor)));
            buf32[row * w + col] = amplitudeToPixel(Math.round(norm * 255), 0, 255, colorMap);
          }
        }

        wfCtx.putImageData(imageData, 0, 0);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isCollapsed, colorMapId, floor, ceiling, connected, spectrumEnabled, latestSpectrumRef, waterfallHistoryRef]);

  const freqAxisContent = (() => {
    const data = latestSpectrumRef.current;
    if (!data || !data.lowFreq || !data.highFreq) return null;
    const ticks = 5;
    return (
      <div className="relative h-5 text-[0.5rem] text-gray-400 select-none">
        {Array.from({ length: ticks }, (_, i) => {
          const frac = i / (ticks - 1);
          const hz = data.lowFreq + frac * (data.highFreq - data.lowFreq);
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2"
              style={{ left: `${frac * 100}%` }}
            >
              {freqLabel(hz)}
            </span>
          );
        })}
      </div>
    );
  })();

  const headerActions = (
    <div className="flex items-center gap-2 mr-1">
      <select
        value={colorMapId}
        onChange={e => setColorMapId(e.target.value)}
        className="bg-gray-700 text-gray-200 text-[0.5rem] rounded px-1 py-0.5 border border-gray-600"
        onClick={e => e.stopPropagation()}
      >
        {COLORMAP_NAMES.map(cm => (
          <option key={cm.id} value={cm.id}>{cm.label}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-[0.5rem] text-gray-400">
        Floor
        <input
          type="range" min={-160} max={-60} step={5}
          value={floor}
          onChange={e => setFloor(Number(e.target.value))}
          className="w-14 accent-green-500"
          onClick={e => e.stopPropagation()}
        />
        <span className="w-8">{floor}</span>
      </label>
      <label className="flex items-center gap-1 text-[0.5rem] text-gray-400">
        Ceil
        <input
          type="range" min={-100} max={0} step={5}
          value={ceiling}
          onChange={e => setCeiling(Number(e.target.value))}
          className="w-14 accent-green-500"
          onClick={e => e.stopPropagation()}
        />
        <span className="w-8">{ceiling}</span>
      </label>
    </div>
  );

  const renderBody = () => {
    if (!spectrumEnabled) {
      return (
        <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
          Spectrum scope is disabled. Enable it in Settings → Spectrum.
        </div>
      );
    }
    if (!spectrumSupported && connected) {
      return (
        <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
          This radio does not report spectrum data via Hamlib.
        </div>
      );
    }
    if (!connected) {
      return (
        <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
          Not connected to rig.
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0">
        <canvas
          ref={spectrumCanvasRef}
          width={600}
          height={spectrumHeight}
          className="w-full"
          style={{ height: spectrumHeight, cursor: "crosshair" }}
          onClick={handleCanvasClick}
          title="Click to tune"
        />
        <canvas
          ref={waterfallCanvasRef}
          width={600}
          height={waterfallHeight}
          className="w-full"
          style={{ height: waterfallHeight, cursor: "crosshair" }}
          onClick={handleCanvasClick}
          title="Click to tune"
        />
        {freqAxisContent}
      </div>
    );
  };

  return (
    <PanelChrome
      title="Spectrum Scope"
      icon={<Activity size={14} />}
      isCollapsed={isCollapsed}
      setIsCollapsed={setIsCollapsed}
      headerActions={headerActions}
      headerSize="sm"
      bodyClassName="p-0"
    >
      {renderBody()}
    </PanelChrome>
  );
}
