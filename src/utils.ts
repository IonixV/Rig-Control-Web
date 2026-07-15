import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStep(s: number): string {
  if (s >= 1) return `${s} MHz`;
  if (s >= 0.001) return `${s * 1000} kHz`;
  return `${s * 1000000} Hz`;
}

// Chromium's enumerateDevices() includes its own synthetic deviceId "default" entry
// alongside real devices. Our device pickers already render a hardcoded "Default"
// option, so keeping the browser's copy creates two <option value="default"> siblings
// and the <select> always displays whichever one is first in DOM order regardless of
// which the user actually picked. Drop it here so "default" appears exactly once.
export function splitLocalAudioDevices(devices: MediaDeviceInfo[]): { inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] } {
  const real = devices.filter(d => d.deviceId !== "default");
  return {
    inputs: real.filter(d => d.kind === "audioinput"),
    outputs: real.filter(d => d.kind === "audiooutput"),
  };
}
