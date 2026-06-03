import React from "react";
import type { Socket } from "socket.io-client";
import {
  Monitor,
  Power,
  X,
} from "lucide-react";
import { cn } from "../utils";

export interface VideoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;

  videoDevices: { id: string; label: string }[];
  videoSettings: {
    device: string;
    videoWidth: number;
    videoHeight: number;
    framerate: string;
  };
  setVideoSettings: React.Dispatch<
    React.SetStateAction<{
      device: string;
      videoWidth: number;
      videoHeight: number;
      framerate: string;
    }>
  >;
  videoStatus: "streaming" | "stopped";
  isElectronSource: boolean;
  resolutionDraft: { width: string; height: string };
  setResolutionDraft: React.Dispatch<
    React.SetStateAction<{ width: string; height: string }>
  >;
  isResolutionFocusedRef: React.MutableRefObject<boolean>;
  resolutionDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  resolutionDraftRef: React.MutableRefObject<{ width: string; height: string }>;
  videoSettingsRef: React.MutableRefObject<{
    device: string;
    videoWidth: number;
    videoHeight: number;
    framerate: string;
  }>;
}

function VideoSettingsModal({
  isOpen,
  onClose,
  socket,
  videoDevices,
  videoSettings,
  setVideoSettings,
  videoStatus,
  isElectronSource,
  resolutionDraft,
  setResolutionDraft,
  isResolutionFocusedRef,
  resolutionDebounceRef,
  resolutionDraftRef,
  videoSettingsRef,
}: VideoSettingsModalProps) {
  if (!isOpen) return null;
  return (
<div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
  <div className="bg-[#151619] w-full max-w-md rounded-2xl border border-[#2a2b2e] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
    <div className="p-6 border-b border-[#2a2b2e] flex items-center justify-between bg-[#1a1b1e]">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
          <Monitor size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight uppercase italic">Video Settings</h2>
        </div>
      </div>
      <button 
        onClick={() => onClose()}
        className="p-2 hover:bg-[#2a2b2e] rounded-xl text-[#8e9299] transition-all"
      >
        <X size={20} />
      </button>
    </div>

    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[0.625rem] uppercase text-[#8e9299] font-bold">Video Device</label>
          <select
            value={videoSettings.device}
            onChange={(e) => {
              const newSettings = { ...videoSettings, device: e.target.value };
              setVideoSettings(newSettings);
              socket?.emit("update-video-settings", newSettings);
            }}
            className="w-full bg-[#0a0a0a] border border-[#2a2b2e] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all"
          >
            <option value="">Select Device</option>
            {videoDevices.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          {!isElectronSource && videoDevices.length === 0 && (
            <p className="text-[0.625rem] text-[#8e9299]">Device list is populated by the host Electron app.</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[0.625rem] uppercase text-[#8e9299] font-bold">Resolution (Width × Height)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={resolutionDraft.width}
              onFocus={() => { isResolutionFocusedRef.current = true; }}
              onBlur={() => { isResolutionFocusedRef.current = false; }}
              onChange={(e) => {
                const raw = e.target.value;
                const next = { ...resolutionDraftRef.current, width: raw };
                resolutionDraftRef.current = next;
                setResolutionDraft(next);
                if (resolutionDebounceRef.current) clearTimeout(resolutionDebounceRef.current);
                resolutionDebounceRef.current = setTimeout(() => {
                  const w = parseInt(resolutionDraftRef.current.width);
                  const h = parseInt(resolutionDraftRef.current.height);
                  if (w > 0 && w <= 7680 && h > 0 && h <= 4320) {
                    const newSettings = { ...videoSettingsRef.current, videoWidth: w, videoHeight: h };
                    setVideoSettings(newSettings);
                    socket?.emit("update-video-settings", newSettings);
                  }
                }, 800);
              }}
              className="w-24 bg-[#0a0a0a] border border-[#2a2b2e] rounded-lg px-3 py-3 text-sm text-center focus:outline-none focus:border-emerald-500 transition-all"
            />
            <span className="text-[#8e9299] font-bold text-sm">×</span>
            <input
              type="text"
              inputMode="numeric"
              value={resolutionDraft.height}
              onFocus={() => { isResolutionFocusedRef.current = true; }}
              onBlur={() => { isResolutionFocusedRef.current = false; }}
              onChange={(e) => {
                const raw = e.target.value;
                const next = { ...resolutionDraftRef.current, height: raw };
                resolutionDraftRef.current = next;
                setResolutionDraft(next);
                if (resolutionDebounceRef.current) clearTimeout(resolutionDebounceRef.current);
                resolutionDebounceRef.current = setTimeout(() => {
                  const w = parseInt(resolutionDraftRef.current.width);
                  const h = parseInt(resolutionDraftRef.current.height);
                  if (w > 0 && w <= 7680 && h > 0 && h <= 4320) {
                    const newSettings = { ...videoSettingsRef.current, videoWidth: w, videoHeight: h };
                    setVideoSettings(newSettings);
                    socket?.emit("update-video-settings", newSettings);
                  }
                }, 800);
              }}
              className="w-24 bg-[#0a0a0a] border border-[#2a2b2e] rounded-lg px-3 py-3 text-sm text-center focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[0.625rem] uppercase text-[#8e9299] font-bold">Framerate</label>
          <select
            value={videoSettings.framerate}
            onChange={(e) => {
              const newSettings = { ...videoSettings, framerate: e.target.value };
              setVideoSettings(newSettings);
              socket?.emit("update-video-settings", newSettings);
            }}
            className="w-full bg-[#0a0a0a] border border-[#2a2b2e] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all"
          >
            <option value="">Select FPS</option>
            <option value="5">5 fps</option>
            <option value="10">10 fps</option>
            <option value="15">15 fps</option>
            <option value="24">24 fps</option>
            <option value="30">30 fps</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => socket?.emit("request-video-start")}
            disabled={!videoSettings.device || !videoSettings.framerate || videoStatus === "streaming"}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-xs transition-all",
              videoStatus === "streaming"
                ? "bg-emerald-500/20 text-emerald-500 cursor-not-allowed"
                : (!videoSettings.device || !videoSettings.framerate)
                  ? "bg-emerald-500/20 text-emerald-500/50 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
            )}
          >
            <Power size={16} />
            Start Video
          </button>
          <button
            onClick={() => socket?.emit("request-video-stop")}
            disabled={videoStatus === "stopped"}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-xs transition-all",
              videoStatus === "stopped"
                ? "bg-red-500/20 text-red-500 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
            )}
          >
            <X size={16} />
            Stop Video
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
  );
}

export default React.memo(VideoSettingsModal);
