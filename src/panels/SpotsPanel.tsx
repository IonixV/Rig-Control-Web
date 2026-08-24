import React from "react";
import { Settings } from "lucide-react";
import { cn } from "../utils";

interface SpotSettingsGearProps {
  accent: 'emerald' | 'amber' | 'sky' | 'rose';
  onClick: () => void;
}

export function SpotSettingsGear({ accent, onClick }: SpotSettingsGearProps) {
  const hoverClass = accent === 'emerald' ? 'hover:text-emerald-400' : accent === 'sky' ? 'hover:text-sky-400' : accent === 'rose' ? 'hover:text-rose-400' : 'hover:text-amber-400';
  return (
    <button
      onClick={onClick}
      className={cn("p-1 rounded transition-colors text-[#8e9299]", hoverClass)}
      title="Spot settings"
    >
      <Settings size={11} />
    </button>
  );
}

export interface SpotsPanelProps {
  type: "pota" | "sota" | "wwff" | "dx";
  renderTable: () => React.ReactElement;
}

export default function SpotsPanel({ renderTable }: SpotsPanelProps) {
  return (
    <div>
      {renderTable()}
    </div>
  );
}
