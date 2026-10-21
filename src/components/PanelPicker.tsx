import React, { useState } from "react";
import { X, ChevronLeft } from "lucide-react";
import { cn } from "../utils";
import { PANEL_LABELS, PANEL_CONFIG_OPTIONS } from "../types/layout";
import type { PanelType, PanelAddConfig } from "../types/layout";

const PANEL_ORDER: PanelType[] = [
  "vfo",
  "smeter",
  "video_feed",
  "audio_feed",
  "controls",
  "rflevels",
  "swr",
  "alc",
  "modebw",
  "cwdecode",
  "ft8decode",
  "commandconsole",
  "spots_pota",
  "spots_sota",
  "spots_wwff",
  "spots_dx",
  "solar",
  "mufmap",
];

interface PanelPickerProps {
  existingTypes: Set<PanelType>;
  availableTypes?: PanelType[];
  onSelect: (type: PanelType, config: PanelAddConfig) => void;
  onClose: () => void;
}

export default function PanelPicker({ existingTypes, availableTypes, onSelect, onClose }: PanelPickerProps) {
  const displayTypes = availableTypes ?? PANEL_ORDER;

  const [step, setStep] = useState<'pick' | 'config'>('pick');
  const [pendingType, setPendingType] = useState<PanelType | null>(null);
  const [heightPx, setHeightPx] = useState(400);
  const [fullWidth, setFullWidth] = useState(true);

  function handleTypeClick(type: PanelType) {
    const opts = PANEL_CONFIG_OPTIONS[type];
    if (opts) {
      setPendingType(type);
      setHeightPx(opts.defaultHeightPx ?? 400);
      setFullWidth(opts.defaultFullWidth ?? false);
      setStep('config');
    } else {
      onSelect(type, {});
      onClose();
    }
  }

  function handleConfirm() {
    if (!pendingType) return;
    const opts = PANEL_CONFIG_OPTIONS[pendingType];
    onSelect(pendingType, {
      ...(opts?.hasHeightSlider && { heightPx }),
      ...(opts?.hasFullWidth && { fullWidth }),
    });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Picker panel */}
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-panel border border-line rounded-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-line bg-panel-2">
          {step === 'config' ? (
            <button
              onClick={() => setStep('pick')}
              className="flex items-center gap-1 text-muted hover:text-ink transition-colors"
            >
              <ChevronLeft size={13} />
              <span className="text-[0.5625rem] uppercase tracking-widest font-bold">
                {PANEL_LABELS[pendingType!]}
              </span>
            </button>
          ) : (
            <span className="text-[0.5625rem] uppercase tracking-widest font-bold text-muted">Add Panel</span>
          )}
          <button onClick={onClose} className="p-1 text-muted hover:text-ink rounded hover:bg-ink/5 transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Step 1: panel grid */}
        {step === 'pick' && (
          <div className="p-2 grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto custom-scrollbar">
            {displayTypes.map((type) => {
              const inUse = existingTypes.has(type);
              return (
                <button
                  key={type}
                  disabled={inUse}
                  onClick={() => handleTypeClick(type)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border",
                    inUse
                      ? "text-faint border-line cursor-not-allowed"
                      : "text-ink border-line hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300"
                  )}
                >
                  {PANEL_LABELS[type]}
                  {inUse && <span className="block text-[0.5rem] text-faint normal-case tracking-normal mt-0.5">already placed</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: config */}
        {step === 'config' && pendingType && (() => {
          const opts = PANEL_CONFIG_OPTIONS[pendingType]!;
          return (
            <div className="p-4 space-y-4">
              {opts.hasHeightSlider && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.625rem] uppercase tracking-widest font-bold text-muted">Height</span>
                    <span className="text-[0.625rem] font-mono text-ink">{heightPx}px</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={800}
                    step={10}
                    value={heightPx}
                    onChange={(e) => setHeightPx(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[0.5rem] text-faint-2">
                    <span>200px</span>
                    <span>800px</span>
                  </div>
                </div>
              )}

              {opts.hasFullWidth && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fullWidth}
                    onChange={(e) => setFullWidth(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-500"
                  />
                  <span className="text-[0.625rem] uppercase tracking-widest font-bold text-muted">Full Width</span>
                </label>
              )}

              <button
                onClick={handleConfirm}
                className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Add Panel
              </button>
            </div>
          );
        })()}
      </div>
    </>
  );
}
