const argv = process.argv;

export const ts = (): string => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
};

if (argv.includes('--help')) {
  console.log(`
RigControl Web

Usage: npm run dev [-- <options>]

Debug options:
  --debug-rig        Rig communication (rigctld TCP commands, poll results)
  --debug-audio      Audio pipeline (naudiodon, Opus encode/decode, mic routing)
  --debug-video      Video relay (H.264 chunk forwarding, keyframe buffering)
  --debug-cw         CW keyer (iambic state machine, DTR/RTS key events)
  --debug-infra      Infrastructure (TLS, settings, Socket.io lifecycle)
  --debug-spectrum   Spectrum scope (Hamlib UDP multicast, FT4222 SPI frames)
  --debug-spots      Spot integration (POTA/SOTA/WWFF fetch lifecycle)
  --debug-wsjtx      WSJTX bridge (WebSocket lifecycle, rig command relay)
  --debug-all        Enable all debug flags
  --help             Show this help message
`);
  process.exit(0);
}

const debugAll = argv.includes('--debug-all') || process.env.DEBUG_ALL === '1';

const flag = (name: string, env: string) =>
  debugAll || argv.includes(`--debug-${name}`) || process.env[env] === '1';

export type DebugFlags = {
  rig: boolean;
  audio: boolean;
  video: boolean;
  cw: boolean;
  infra: boolean;
  spectrum: boolean;
  spots: boolean;
  wsjtx: boolean;
};

// Mutable, live source of truth for every vlog* wrapper below — seeded from
// CLI/env at startup, but toggled at runtime by the Diagnostics tab
// (server/diagnostics.ts) without requiring a restart.
export const debugFlags: DebugFlags = {
  rig: flag('rig', 'DEBUG_RIG'),
  audio: flag('audio', 'DEBUG_AUDIO'),
  video: flag('video', 'DEBUG_VIDEO'),
  cw: flag('cw', 'DEBUG_CW'),
  infra: flag('infra', 'DEBUG_INFRA'),
  spectrum: flag('spectrum', 'DEBUG_SPECTRUM'),
  spots: flag('spots', 'DEBUG_SPOTS'),
  wsjtx: flag('wsjtx', 'DEBUG_WSJTX'),
};

export function setDebugFlag(key: keyof DebugFlags, value: boolean): void {
  debugFlags[key] = value;
}

export const vlogRig      = (...args: any[]) => { if (debugFlags.rig)      console.log(`[${ts()}]`, ...args); };
export const vlogAudio    = (...args: any[]) => { if (debugFlags.audio)    console.log(`[${ts()}]`, ...args); };
export const vlogVideo    = (...args: any[]) => { if (debugFlags.video)    console.log(`[${ts()}]`, ...args); };
export const vlogCw       = (...args: any[]) => { if (debugFlags.cw)       console.log(`[${ts()}]`, ...args); };
export const vlogInfra    = (...args: any[]) => { if (debugFlags.infra)    console.log(`[${ts()}]`, ...args); };
export const vlogSpectrum = (...args: any[]) => { if (debugFlags.spectrum) console.log(`[${ts()}]`, ...args); };
export const vlogSpots    = (...args: any[]) => { if (debugFlags.spots)    console.log(`[${ts()}]`, ...args); };
export const vlogWsjtx   = (...args: any[]) => { if (debugFlags.wsjtx)    console.log(`[${ts()}]`, ...args); };
