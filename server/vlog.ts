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

export const DEBUG_RIG      = debugAll || argv.includes('--debug-rig')      || process.env.DEBUG_RIG      === '1';
export const DEBUG_AUDIO    = debugAll || argv.includes('--debug-audio')    || process.env.DEBUG_AUDIO    === '1';
export const DEBUG_VIDEO    = debugAll || argv.includes('--debug-video')    || process.env.DEBUG_VIDEO    === '1';
export const DEBUG_CW       = debugAll || argv.includes('--debug-cw')       || process.env.DEBUG_CW       === '1';
export const DEBUG_INFRA    = debugAll || argv.includes('--debug-infra')    || process.env.DEBUG_INFRA    === '1';
export const DEBUG_SPECTRUM = debugAll || argv.includes('--debug-spectrum') || process.env.DEBUG_SPECTRUM === '1';
export const DEBUG_SPOTS    = debugAll || argv.includes('--debug-spots')    || process.env.DEBUG_SPOTS    === '1';
export const DEBUG_WSJTX    = debugAll || argv.includes('--debug-wsjtx')   || process.env.DEBUG_WSJTX    === '1';

export const vlogRig      = (...args: any[]) => { if (DEBUG_RIG)      console.log(`[${ts()}]`, ...args); };
export const vlogAudio    = (...args: any[]) => { if (DEBUG_AUDIO)    console.log(`[${ts()}]`, ...args); };
export const vlogVideo    = (...args: any[]) => { if (DEBUG_VIDEO)    console.log(`[${ts()}]`, ...args); };
export const vlogCw       = (...args: any[]) => { if (DEBUG_CW)       console.log(`[${ts()}]`, ...args); };
export const vlogInfra    = (...args: any[]) => { if (DEBUG_INFRA)    console.log(`[${ts()}]`, ...args); };
export const vlogSpectrum = (...args: any[]) => { if (DEBUG_SPECTRUM) console.log(`[${ts()}]`, ...args); };
export const vlogSpots    = (...args: any[]) => { if (DEBUG_SPOTS)    console.log(`[${ts()}]`, ...args); };
export const vlogWsjtx   = (...args: any[]) => { if (DEBUG_WSJTX)    console.log(`[${ts()}]`, ...args); };

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

export const debugFlags: DebugFlags = {
  rig: DEBUG_RIG,
  audio: DEBUG_AUDIO,
  video: DEBUG_VIDEO,
  cw: DEBUG_CW,
  infra: DEBUG_INFRA,
  spectrum: DEBUG_SPECTRUM,
  spots: DEBUG_SPOTS,
  wsjtx: DEBUG_WSJTX,
};
