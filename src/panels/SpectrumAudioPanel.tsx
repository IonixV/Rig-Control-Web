import React, { useRef, useEffect, useState } from "react";
import { Waves } from "lucide-react";
import PanelChrome from "../components/PanelChrome";
import { COLORMAPS, COLORMAP_NAMES, amplitudeToPixel } from "../utils/spectrumColors";

const DEFAULT_HEIGHT = 350;
const SPECTRUM_RATIO = 0.3;
const FLOOR_DEFAULT = -120;
const CEILING_DEFAULT = -20;
const WATERFALL_MAX_LINES = 300;

interface Props {
  analyserNodeRef: React.MutableRefObject<AnalyserNode | null>;
  audioStatus: "playing" | "stopped";
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  heightPx?: number;
  bandwidth?: number;
  mode?: string;
}

function computeDisplayBandwidth(bandwidth: number, mode: string, maxHz: number): number {
  const bw = bandwidth === 0 ? 3000 : bandwidth;
  const isCw = mode === "CW" || mode === "CWR";
  return Math.min(isCw ? bw * 2 : bw, maxHz);
}

export default function SpectrumAudioPanel({
  analyserNodeRef,
  audioStatus,
  isCollapsed,
  setIsCollapsed,
  heightPx = DEFAULT_HEIGHT,
  bandwidth = 0,
  mode = "",
}: Props) {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const waterfallLinesRef = useRef<Float32Array[]>([]);
  const freqDataBufRef = useRef<Float32Array | null>(null);
  const prevDisplayBwRef = useRef<number>(0);

  const [colorMapId, setColorMapId] = useState("classic");
  const [floor, setFloor] = useState(FLOOR_DEFAULT);
  const [ceiling, setCeiling] = useState(CEILING_DEFAULT);

  const spectrumHeight = Math.floor(heightPx * SPECTRUM_RATIO);
  const waterfallHeight = heightPx - spectrumHeight - 20;

  const sampleRate = analyserNodeRef.current?.context.sampleRate ?? 48000;
  const maxHz = sampleRate / 2;
  const displayBandwidth = computeDisplayBandwidth(bandwidth, mode, maxHz);

  useEffect(() => {
    if (isCollapsed || audioStatus !== "playing") return;

    if (displayBandwidth !== prevDisplayBwRef.current) {
      waterfallLinesRef.current = [];
      prevDisplayBwRef.current = displayBandwidth;
    }

    const colorMap = COLORMAPS[colorMapId] ?? COLORMAPS.classic;

    const draw = () => {
      const analyser = analyserNodeRef.current;
      const specCanvas = spectrumCanvasRef.current;
      const wfCanvas = waterfallCanvasRef.current;

      if (!analyser || !specCanvas || !wfCanvas) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const totalBins = analyser.frequencyBinCount;
      const sr = analyser.context.sampleRate;
      const nyquist = sr / 2;
      const displayBw = computeDisplayBandwidth(bandwidth, mode, nyquist);
      const endBin = Math.min(totalBins, Math.round((displayBw / nyquist) * totalBins));

      if (!freqDataBufRef.current || freqDataBufRef.current.length !== totalBins) {
        freqDataBufRef.current = new Float32Array(totalBins);
      }
      analyser.getFloatFrequencyData(freqDataBufRef.current);
      const freqData = freqDataBufRef.current;

      // Capture full waterfall line; rendering slices to endBin
      waterfallLinesRef.current = [
        freqData.slice(),
        ...waterfallLinesRef.current,
      ].slice(0, WATERFALL_MAX_LINES);

      const w = specCanvas.width;

      // --- Spectrum line ---
      const sCtx = specCanvas.getContext("2d");
      if (sCtx) {
        const sh = specCanvas.height;
        sCtx.clearRect(0, 0, w, sh);

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
        sCtx.strokeStyle = "#3b82f6";
        sCtx.fillStyle = "rgba(59,130,246,0.25)";
        sCtx.lineWidth = 1.5;

        const step = endBin / w;
        for (let col = 0; col < w; col++) {
          const binIdx = Math.min(endBin - 1, Math.floor(col * step));
          const dbfs = freqData[binIdx];
          const norm = Math.max(0, Math.min(1, (dbfs - floor) / (ceiling - floor)));
          const y = sh - norm * sh;
          if (col === 0) {
            sCtx.moveTo(col, sh);
            sCtx.lineTo(col, y);
          } else {
            sCtx.lineTo(col, y);
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
        const lines = waterfallLinesRef.current;
        const visibleLines = Math.min(lines.length, wh);
        const imageData = wfCtx.createImageData(w, wh);
        const buf32 = new Uint32Array(imageData.data.buffer);

        for (let row = 0; row < visibleLines; row++) {
          const line = lines[row];
          const step = endBin / w;
          for (let col = 0; col < w; col++) {
            const binIdx = Math.min(endBin - 1, Math.floor(col * step));
            const dbfs = line[binIdx];
            const norm = Math.max(0, Math.min(1, (dbfs - floor) / (ceiling - floor)));
            buf32[row * w + col] = amplitudeToPixel(Math.round(norm * 255), 0, 255, colorMap);
          }
        }

        wfCtx.putImageData(imageData, 0, 0);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCollapsed, audioStatus, colorMapId, floor, ceiling, analyserNodeRef, bandwidth, mode, displayBandwidth]);

  const freqAxisContent = (
    <div className="relative h-5 text-[0.5rem] text-gray-400 select-none">
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
        const hz = frac * displayBandwidth;
        const label = hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
        return (
          <span
            key={i}
            className="absolute -translate-x-1/2"
            style={{ left: `${frac * 100}%` }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );

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
          type="range" min={-160} max={-20} step={5}
          value={floor}
          onChange={e => setFloor(Number(e.target.value))}
          className="w-14 accent-blue-500"
          onClick={e => e.stopPropagation()}
        />
        <span className="w-8">{floor}</span>
      </label>
      <label className="flex items-center gap-1 text-[0.5rem] text-gray-400">
        Ceil
        <input
          type="range" min={-80} max={0} step={5}
          value={ceiling}
          onChange={e => setCeiling(Number(e.target.value))}
          className="w-14 accent-blue-500"
          onClick={e => e.stopPropagation()}
        />
        <span className="w-8">{ceiling}</span>
      </label>
    </div>
  );

  const renderBody = () => {
    if (audioStatus !== "playing") {
      return (
        <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
          Start audio to see the waterfall.
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
          style={{ height: spectrumHeight }}
        />
        <canvas
          ref={waterfallCanvasRef}
          width={600}
          height={waterfallHeight}
          className="w-full"
          style={{ height: waterfallHeight }}
        />
        {freqAxisContent}
      </div>
    );
  };

  return (
    <PanelChrome
      title="Audio Waterfall"
      icon={<Waves size={14} />}
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
