import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "../utils";
import type { RigStatus } from "../types";

export interface TabbedMeterHeaderContentProps {
  isCollapsed: boolean;
  status: RigStatus;
  meterTab: "signal" | "swr" | "alc";
  setMeterTab: React.Dispatch<React.SetStateAction<"signal" | "swr" | "alc">>;
}

export function TabbedMeterHeaderContent({
  isCollapsed,
  status,
  meterTab,
  setMeterTab,
}: TabbedMeterHeaderContentProps) {
  return (
    <div className="flex items-center justify-between w-full pr-2">
      {isCollapsed ? (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-mono font-bold",
              status.ptt ? "text-red-500" : "text-emerald-500"
            )}
          >
            {status.ptt
              ? `${Math.round((status.powerMeter ?? 0) * 100)}W`
              : (status.smeter ?? -54) > 0
              ? `S9+${status.smeter}dB`
              : `S${Math.round(((status.smeter ?? -54) + 54) / 6)}`}
          </span>
          <span className="text-[#3a3b3e]">·</span>
          <span
            className={cn(
              "text-sm font-mono font-bold",
              (status.swr ?? 1) > 3 ? "text-red-500" : "text-amber-500"
            )}
          >
            {(status.swr ?? 1).toFixed(2)}
          </span>
          <span className="text-[#3a3b3e]">·</span>
          <span className="text-sm font-mono font-bold text-blue-400">
            {(status.alc ?? 0).toFixed(2)}
          </span>
        </div>
      ) : (
        <div className="flex gap-2">
          {(["signal", "swr", "alc"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMeterTab(m)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all",
                meterTab === m
                  ? m === "swr" && (status.swr ?? 1) > 3
                    ? "bg-red-500 text-white"
                    : "bg-emerald-500 text-white"
                  : m === "swr" && (status.swr ?? 1) > 3
                  ? "text-red-500 bg-red-500/10"
                  : "text-[#8e9299] hover:bg-white/5"
              )}
            >
              {m === "signal" ? "SIG/PWR" : m.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {!isCollapsed && (
        <div className="flex flex-col items-end">
          {meterTab === "signal" && (
            <span
              className={cn(
                "text-lg font-mono font-bold",
                status.ptt ? "text-red-500" : "text-emerald-500"
              )}
            >
              {status.ptt
                ? `${Math.round((status.powerMeter ?? 0) * 100)}W`
                : (status.smeter ?? -54) > 0
                ? `S9+${status.smeter}dB`
                : `S${Math.round(((status.smeter ?? -54) + 54) / 6)}`}
            </span>
          )}
          {meterTab === "swr" && (
            <span
              className={cn(
                "text-lg font-mono font-bold",
                (status.swr ?? 1) > 3 ? "text-red-500" : "text-amber-500"
              )}
            >
              {(status.swr ?? 1).toFixed(2)}
            </span>
          )}
          {meterTab === "alc" && (
            <span className="text-lg font-mono font-bold text-blue-500">
              {(status.alc ?? 0).toFixed(5)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export interface TabbedMeterPanelProps {
  status: RigStatus;
  history: any[];
  meterTab: "signal" | "swr" | "alc";
}

export default function TabbedMeterPanel({
  status,
  history,
  meterTab,
}: TabbedMeterPanelProps) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#2a2b2e"
            vertical={false}
            opacity={0.3}
          />
          <XAxis dataKey="time" hide />
          {meterTab === "signal" ? (
            <>
              <YAxis yAxisId="rx" domain={[-54, 0]} hide />
              <YAxis yAxisId="tx" domain={[0, 1]} orientation="right" hide />
            </>
          ) : (
            <YAxis
              domain={meterTab === "swr" ? [1, 4] : [0, 1]}
              hide
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#151619",
              border: "1px solid #2a2b2e",
              fontSize: "12px",
            }}
            formatter={(val: number, name: string, props: any) => {
              if (meterTab === "signal") {
                if (name === "smeterGraph") {
                  const rawVal = props.payload?.smeter ?? val;
                  return [
                    rawVal > 0
                      ? `S9+${rawVal}dB`
                      : `S${Math.round((rawVal + 54) / 6)}`,
                    "SIGNAL",
                  ];
                }
                return [`${Math.round((val ?? 0) * 100)}W`, "POWER"];
              }
              if (meterTab === "swr") {
                return [(props.payload?.swr ?? 1).toFixed(2), "SWR"];
              }
              return [
                (val ?? 0).toFixed(meterTab === "alc" ? 5 : 2),
                meterTab.toUpperCase(),
              ];
            }}
          />
          {meterTab === "signal" ? (
            <>
              <Line
                yAxisId="rx"
                type="monotone"
                dataKey="smeterGraph"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="tx"
                type="monotone"
                dataKey="powerMeter"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey={meterTab === "swr" ? "swrGraph" : "alc"}
              stroke={
                meterTab === "swr"
                  ? (status.swr ?? 1) > 3
                    ? "#ef4444"
                    : "#f59e0b"
                  : "#3b82f6"
              }
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
