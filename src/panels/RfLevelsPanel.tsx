import React from "react";
import { cn } from "../utils";
import type { NbCapabilities, NrCapabilities, RfPowerCapabilities, RfLevelCapabilities } from "../types";

export interface RfLevelsPanelProps {
  variant: "phone" | "compact";
  connected: boolean;
  localRFPower: number;
  setLocalRFPower: (v: number) => void;
  rfPowerCapabilities: RfPowerCapabilities;
  isDraggingRF: React.MutableRefObject<boolean>;
  localRFLevel: number;
  setLocalRFLevel: (v: number) => void;
  rfLevelCapabilities: RfLevelCapabilities;
  isDraggingRFLevel: React.MutableRefObject<boolean>;
  localNRLevel: number;
  setLocalNRLevel: (v: number) => void;
  nrCapabilities: NrCapabilities;
  isDraggingNR: React.MutableRefObject<boolean>;
  localNBLevel: number;
  setLocalNBLevel: (v: number) => void;
  nbCapabilities: NbCapabilities;
  isDraggingNB: React.MutableRefObject<boolean>;
}

export default function RfLevelsPanel({
  variant,
  connected,
  localRFPower,
  setLocalRFPower,
  rfPowerCapabilities,
  isDraggingRF,
  localRFLevel,
  setLocalRFLevel,
  rfLevelCapabilities,
  isDraggingRFLevel,
  localNRLevel,
  setLocalNRLevel,
  nrCapabilities,
  isDraggingNR,
  localNBLevel,
  setLocalNBLevel,
  nbCapabilities,
  isDraggingNB,
}: RfLevelsPanelProps) {
  const isPhone = variant === "phone";
  const sliderH = isPhone ? "h-2" : "h-1";

  const sliders = (
    <>
      {/* RF Power */}
      <div className={isPhone ? "space-y-1.5" : ""}>
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase text-[#8e9299]">RF Power</span>
            <span className="text-sm text-emerald-500 font-bold">{Math.round(localRFPower * 100)}%</span>
          </div>
          <input
            type="range"
            min={rfPowerCapabilities.range.min * 100}
            max={rfPowerCapabilities.range.max * 100}
            step={rfPowerCapabilities.range.step * 100}
            value={localRFPower * 100}
            disabled={!connected}
            onChange={(e) => { isDraggingRF.current = true; setLocalRFPower(parseFloat(e.target.value) / 100); }}
            data-testid="rflevels-rfpower-slider"
            className={cn(`w-full accent-emerald-500 ${sliderH} bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer`, !connected && "opacity-50 cursor-not-allowed")}
          />
        </div>

      {/* RF Level — only shown when the rig's dump_caps actually lists RF as a level (distinct from RF as an on/off func) */}
      {rfLevelCapabilities.supported && (
        <div className={isPhone ? "space-y-1.5" : "mt-3"}>
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase text-[#8e9299]">RF Level</span>
              <span className="text-sm text-emerald-500 font-bold">{Math.round(localRFLevel * 100)}%</span>
            </div>
            <input
              type="range"
              min={rfLevelCapabilities.range.min} max={rfLevelCapabilities.range.max} step={rfLevelCapabilities.range.step}
              value={localRFLevel}
              disabled={!connected}
              onChange={(e) => { isDraggingRFLevel.current = true; setLocalRFLevel(parseFloat(e.target.value)); }}
              data-testid="rflevels-rflevel-slider"
              className={cn(`w-full accent-emerald-500 ${sliderH} bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer`, !connected && "opacity-50 cursor-not-allowed")}
            />
          </div>
      )}

      {/* DNR Level — shown whenever the rig's dump_caps lists NR as a level (distinct from NR as an on/off func). A degenerate zero-step range (seen live on Hamlib's Dummy rig, model 1) can't drive the step-index math below, so it's treated as a fixed "Lvl 0" control instead of hidden or NaN. */}
      {nrCapabilities.levelSupported && (() => {
        const nrStepValid = nrCapabilities.range.step > 0;
        const nrStepIdx = nrStepValid
          ? Math.max(1, Math.round((localNRLevel - nrCapabilities.range.min) / nrCapabilities.range.step))
          : 0;
        const nrStepMax = nrStepValid
          ? Math.round((nrCapabilities.range.max - nrCapabilities.range.min) / nrCapabilities.range.step)
          : 0;
        return (
          <div className={isPhone ? "space-y-1.5" : "mt-3"}>
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase text-[#8e9299]">DNR Level</span>
              <span className="text-sm text-emerald-500 font-bold">Lvl {nrStepIdx}</span>
            </div>
            <input
              type="range" min={nrStepValid ? 1 : 0}
              max={nrStepValid ? nrStepMax : 0}
              step="1"
              value={nrStepIdx}
              disabled={!connected}
              onChange={(e) => {
                isDraggingNR.current = true;
                const stepIdx = parseInt(e.target.value);
                setLocalNRLevel(Math.min(nrCapabilities.range.max, nrCapabilities.range.min + stepIdx * nrCapabilities.range.step));
              }}
              data-testid="rflevels-dnr-slider"
              className={cn(`w-full accent-emerald-500 ${sliderH} bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer`, !connected && "opacity-50 cursor-not-allowed")}
            />
          </div>
        );
      })()}

      {/* NB Level — only shown when the rig's dump_caps lists NB as a level (distinct from NB as an on/off func) */}
      {nbCapabilities.levelSupported && (
        <div className={isPhone ? "space-y-1.5" : "mt-3"}>
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase text-[#8e9299]">NB Level</span>
              <span className="text-sm text-emerald-500 font-bold">Lvl {Math.round(localNBLevel)}</span>
            </div>
            <input
              type="range"
              min={nbCapabilities.range.min} max={nbCapabilities.range.max} step={nbCapabilities.range.step}
              value={localNBLevel}
              disabled={!connected}
              onChange={(e) => { isDraggingNB.current = true; setLocalNBLevel(parseFloat(e.target.value)); }}
              data-testid="rflevels-nb-slider"
              className={cn(`w-full accent-emerald-500 ${sliderH} bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer`, !connected && "opacity-50 cursor-not-allowed")}
            />
          </div>
      )}
    </>
  );

  return sliders;
}
