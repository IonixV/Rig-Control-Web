import React from "react";
import type { Socket } from "socket.io-client";
import { Headphones, Volume2, VolumeX, Mic, MicOff, Settings } from "lucide-react";
import { cn } from "../utils";
import type { AudioSettings } from "../types";

export interface AudioFeedHeaderActionsProps {
  variant: "phone" | "compact";
  socket: Socket | null;
  audioStatus: "playing" | "stopped";
  localAudioReady: boolean;
  audioWasRestarted: boolean;
  audioSettings: AudioSettings;
  inboundMuted: boolean;
  setInboundMuted: React.Dispatch<React.SetStateAction<boolean>>;
  outboundMuted: boolean;
  setOutboundMuted: React.Dispatch<React.SetStateAction<boolean>>;
  handleJoinAudio: () => void;
  setIsAudioSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function AudioFeedHeaderActions({
  variant,
  socket,
  audioStatus,
  localAudioReady,
  audioWasRestarted,
  audioSettings,
  inboundMuted,
  setInboundMuted,
  outboundMuted,
  setOutboundMuted,
  handleJoinAudio,
  setIsAudioSettingsOpen,
}: AudioFeedHeaderActionsProps) {
  const settingsIconSize = variant === "phone" ? 14 : 12;

  return (
    <div className="flex items-center gap-2">
      {audioStatus === "playing" && !localAudioReady ? (
        <button
          onClick={handleJoinAudio}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[0.5rem] uppercase font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all border border-blue-500/30 mr-1"
          title="Join the active audio session"
        >
          <Headphones size={10} />
          {audioWasRestarted ? "Restarted — Join Audio" : "Join Audio"}
        </button>
      ) : (
        <div className="flex items-center gap-1 mr-1">
          <button
            onClick={() => setInboundMuted(!inboundMuted)}
            disabled={audioStatus !== "playing" || !localAudioReady}
            className={cn(
              "p-1 rounded-lg transition-all",
              audioStatus !== "playing" || !localAudioReady
                ? "opacity-30 cursor-not-allowed"
                : inboundMuted
                ? "text-red-500 bg-red-500/10"
                : "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20"
            )}
            title={inboundMuted ? "Unmute Inbound Audio" : "Mute Inbound Audio"}
          >
            {inboundMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <button
            onClick={() => {
              const newMuted = !outboundMuted;
              setOutboundMuted(newMuted);
              if (newMuted) {
                socket?.emit("mic-mute-notify");
              } else {
                socket?.emit("mic-unmute-request");
              }
            }}
            disabled={
              audioStatus !== "playing" ||
              !audioSettings.outboundEnabled ||
              !localAudioReady
            }
            className={cn(
              "p-1 rounded-lg transition-all",
              audioStatus !== "playing" ||
                !audioSettings.outboundEnabled ||
                !localAudioReady
                ? "opacity-30 cursor-not-allowed"
                : outboundMuted
                ? "text-red-500 bg-red-500/10"
                : "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
            )}
            title={outboundMuted ? "Unmute Outbound Audio" : "Mute Outbound Audio"}
          >
            {outboundMuted ? <MicOff size={12} /> : <Mic size={12} />}
          </button>
        </div>
      )}
      <button
        onClick={() => setIsAudioSettingsOpen(true)}
        className={cn(
          "hover:bg-[#2a2b2e] rounded-lg text-[#8e9299] transition-all",
          variant === "phone" ? "p-1.5" : "p-1"
        )}
        title="Audio Settings"
      >
        <Settings size={settingsIconSize} />
      </button>
    </div>
  );
}
