import React from "react";
import { Mic, RefreshCw, Signal, Zap, Waves, Activity, Settings, Power, Loader2 } from "lucide-react";
import { cn } from "../utils";
import type { RigStatus, NbCapabilities, NrCapabilities, AnfCapabilities } from "../types";

export interface ControlsPanelProps {
  variant: "phone" | "compact";
  connected: boolean;
  status: RigStatus;
  isTuning: boolean;
  tuneJustFinished: boolean;
  attenuatorLevels: string[];
  preampLevels: string[];
  agcLevels: string[];
  nbCapabilities: NbCapabilities;
  nrCapabilities: NrCapabilities;
  anfCapabilities: AnfCapabilities;
  powerSupported: boolean;
  powerState: 'on' | 'off' | 'unknown';
  poweringOn: boolean;
  knownPoweredOff: boolean;
  handleSetPower: (state: boolean) => void;
  handleSetPTT: (state: boolean) => void;
  handleSetFunc: (func: string, state: boolean) => void;
  handleVfoOp: (op: string) => void;
  cycleAttenuator: () => void;
  cyclePreamp: () => void;
  cycleAgc: () => void;
  getAttenuatorLabel: () => string;
  getPreampLabel: () => string;
  getAgcLabel: () => string;
}

export default function ControlsPanel({
  variant,
  connected,
  status,
  isTuning,
  tuneJustFinished,
  attenuatorLevels,
  preampLevels,
  agcLevels,
  nbCapabilities,
  nrCapabilities,
  anfCapabilities,
  powerSupported,
  powerState,
  poweringOn,
  knownPoweredOff,
  handleSetPower,
  handleSetPTT,
  handleSetFunc,
  handleVfoOp,
  cycleAttenuator,
  cyclePreamp,
  cycleAgc,
  getAttenuatorLabel,
  getPreampLabel,
  getAgcLabel,
}: ControlsPanelProps) {
  const isPhone = variant === "phone";

  const iconSizeLarge = 18;
  const iconSizeSmall = 16;
  const btnBase = "flex flex-col items-center justify-center h-12 rounded-lg border transition-all gap-0.5";
  const btnBasePhone = "flex flex-col items-center justify-center h-12 rounded-xl border transition-all gap-1";
  const labelClass = "text-xs";
  const subLabelClass = "text-[0.625rem]";

  const tuneBtn = (extraClass = "") => (
    <button
      onClick={() => { if (isTuning) return; status.tuner ? handleSetFunc("TUNER", false) : handleVfoOp("TUNE"); }}
      disabled={!connected || isTuning}
      data-testid="controls-tune-button"
      className={cn(
        isPhone ? btnBasePhone : btnBase, extraClass,
        (!connected || isTuning) && "opacity-50 cursor-not-allowed",
        isTuning ? "bg-red-500/20 border-red-500 text-red-500"
          : (status.tuner || tuneJustFinished) ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
          : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
      )}
    >
      <RefreshCw size={isPhone ? 18 : iconSizeLarge} className={cn("transition-transform", isTuning ? "animate-spin" : "")} />
      <span className={cn(labelClass, "uppercase font-bold leading-none")}>Tune</span>
    </button>
  );

  const attenBtn = (extraClass = "") => (
    <button
      onClick={cycleAttenuator}
      disabled={!connected || attenuatorLevels.length === 0}
      data-testid="controls-attenuator-button"
      className={cn(
        isPhone ? btnBasePhone : btnBase, extraClass,
        (!connected || attenuatorLevels.length === 0) && "opacity-50 cursor-not-allowed",
        status.attenuation > 0 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
      )}
    >
      <Signal size={isPhone ? 18 : iconSizeSmall} />
      <span className={cn(labelClass, "uppercase font-bold leading-none")}>{getAttenuatorLabel()}</span>
    </button>
  );

  const preampBtn = (extraClass = "") => (
    <button
      onClick={cyclePreamp}
      disabled={!connected || preampLevels.length === 0}
      data-testid="controls-preamp-button"
      className={cn(
        isPhone ? btnBasePhone : btnBase, extraClass,
        (!connected || preampLevels.length === 0) && "opacity-50 cursor-not-allowed",
        status.preamp > 0 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
      )}
    >
      <Zap size={isPhone ? 18 : iconSizeSmall} />
      <span className={cn(labelClass, "uppercase font-bold leading-none")}>{getPreampLabel()}</span>
    </button>
  );

  const nbBtn = (extraClass = "") => (
    <button
      onClick={() => handleSetFunc("NB", !status.nb)}
      disabled={!connected || !nbCapabilities.supported}
      data-testid="controls-nb-button"
      className={cn(
        isPhone ? btnBasePhone : btnBase, extraClass,
        (!connected || !nbCapabilities.supported) && "opacity-50 cursor-not-allowed",
        status.nb ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
      )}
    >
      <Waves size={isPhone ? 16 : iconSizeSmall} />
      <span className={cn(labelClass, "uppercase font-bold leading-none")}>NB</span>
    </button>
  );

  const nrBtn = (extraClass = "") => (
    <button
      onClick={() => handleSetFunc("NR", !status.nr)}
      disabled={!connected || !nrCapabilities.supported}
      data-testid="controls-nr-button"
      className={cn(
        isPhone ? btnBasePhone : btnBase, extraClass,
        (!connected || !nrCapabilities.supported) && "opacity-50 cursor-not-allowed",
        status.nr ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
      )}
    >
      <Activity size={isPhone ? 16 : iconSizeSmall} />
      <span className={cn(labelClass, "uppercase font-bold leading-none")}>DNR</span>
    </button>
  );

  const anfBtn = (extraClass = "") => (
    <button
      onClick={() => handleSetFunc("ANF", !status.anf)}
      disabled={!connected || !anfCapabilities.supported}
      data-testid="controls-anf-button"
      className={cn(
        isPhone ? btnBasePhone : btnBase, extraClass,
        (!connected || !anfCapabilities.supported) && "opacity-50 cursor-not-allowed",
        status.anf ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
      )}
    >
      <Activity size={isPhone ? 16 : iconSizeSmall} />
      <span className={cn(labelClass, "uppercase font-bold leading-none")}>ANF</span>
    </button>
  );

  const agcBtn = (extraClass = "") => (
    <button
      onClick={cycleAgc}
      disabled={!connected || agcLevels.length === 0}
      data-testid="controls-agc-button"
      className={cn(
        isPhone ? btnBasePhone : btnBase, extraClass,
        (!connected || agcLevels.length === 0) && "opacity-50 cursor-not-allowed",
        status.agc > 0 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
      )}
    >
      <Settings size={isPhone ? 16 : iconSizeSmall} />
      <div className="flex flex-col items-center leading-none">
        <span className={cn(labelClass, "uppercase font-bold")}>AGC</span>
        <span className={cn(subLabelClass, "font-bold opacity-80")}>{getAgcLabel()}</span>
      </div>
    </button>
  );

  const powerBtn = (extraClass = "") => {
    if (!powerSupported) {
      if (knownPoweredOff) {
        return (
          <button
            disabled
            data-testid="controls-power-indicator"
            title="Radio was powered off last session — reconnecting…"
            className={cn(
              isPhone ? btnBasePhone : btnBase, extraClass,
              "opacity-80 cursor-not-allowed bg-red-900/20 border-red-500/50 text-red-500"
            )}
          >
            <Loader2 size={isPhone ? 18 : iconSizeLarge} className="animate-spin" />
            <span className={cn(labelClass, "uppercase font-bold leading-none")}>Pwr</span>
          </button>
        );
      }
      return (
        <button
          disabled
          data-testid="controls-power-indicator"
          title="Radio does not support power control"
          className={cn(
            isPhone ? btnBasePhone : btnBase, extraClass,
            "opacity-50 cursor-not-allowed bg-[#0a0a0a] border-[#2a2b2e]"
          )}
        >
          <Power size={isPhone ? 18 : iconSizeLarge} />
          <span className={cn(labelClass, "uppercase font-bold leading-none")}>Pwr</span>
        </button>
      );
    }

    if (poweringOn) {
      return (
        <button
          disabled
          data-testid="controls-power-indicator"
          title="Waiting for radio to power on…"
          className={cn(
            isPhone ? btnBasePhone : btnBase, extraClass,
            "opacity-80 cursor-not-allowed bg-amber-500/10 border-amber-400 text-amber-300"
          )}
        >
          <Loader2 size={isPhone ? 18 : iconSizeLarge} className="animate-spin" />
          <span className={cn(labelClass, "uppercase font-bold leading-none")}>Pwr</span>
        </button>
      );
    }

    return (
      <button
        onClick={() => handleSetPower(powerState !== 'on')}
        data-testid="controls-power-indicator"
        title={
          powerState === 'on' ? 'Radio ON — click to power off' :
          powerState === 'off' ? 'Radio OFF — click to power on' :
          'Power state unknown'
        }
        className={cn(
          isPhone ? btnBasePhone : btnBase, extraClass,
          powerState === 'on' ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
            : powerState === 'off' ? "bg-red-500/20 border-red-500 text-red-500"
            : "bg-[#0a0a0a] border-[#2a2b2e] text-[#8e9299] hover:border-emerald-500"
        )}
      >
        <Power size={isPhone ? 18 : iconSizeLarge} />
        <span className={cn(labelClass, "uppercase font-bold leading-none")}>Pwr</span>
      </button>
    );
  };

  // Phone: button grids only, no outer box
  if (isPhone) {
    return (
      <>
        <div className="grid grid-cols-4 gap-2">
          {powerBtn()}
          {tuneBtn()}
          {attenBtn()}
          {preampBtn()}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {nbBtn()}
          {agcBtn()}
          {anfBtn()}
          {nrBtn()}
        </div>
      </>
    );
  }

  // Compact: headless content (chrome provided by PanelChrome in layout)
  if (variant === "compact") {

    return (
      <div className="grid grid-cols-3 gap-2 h-full content-start">
        {powerBtn()}
        <button
          onClick={() => handleSetPTT(!status.ptt)}
          disabled={!connected}
          data-testid="controls-ptt-button"
          className={cn(
            btnBase,
            !connected && "opacity-50 cursor-not-allowed",
            status.ptt ? "bg-red-500/20 border-red-500 text-red-500" : "bg-[#0a0a0a] border-[#2a2b2e] hover:border-emerald-500"
          )}
        >
          <Mic size={16} />
          <span className="text-xs uppercase font-bold leading-none">PTT</span>
        </button>
        {tuneBtn()}
        {attenBtn()}
        {preampBtn()}
        {nbBtn()}
        {anfBtn()}
        {agcBtn()}
        {nrBtn()}
      </div>
    );
  }

}
