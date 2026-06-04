const argv = process.argv;
const debugAll = argv.includes('--debug-all');

export const DEBUG_RIG      = debugAll || argv.includes('--debug-rig');
export const DEBUG_AUDIO    = debugAll || argv.includes('--debug-audio');
export const DEBUG_VIDEO    = debugAll || argv.includes('--debug-video');
export const DEBUG_CW       = debugAll || argv.includes('--debug-cw');
export const DEBUG_INFRA    = debugAll || argv.includes('--debug-infra');
export const DEBUG_SPECTRUM = debugAll || argv.includes('--debug-spectrum');

export const vlogRig      = (...args: any[]) => { if (DEBUG_RIG)      console.log(...args); };
export const vlogAudio    = (...args: any[]) => { if (DEBUG_AUDIO)    console.log(...args); };
export const vlogVideo    = (...args: any[]) => { if (DEBUG_VIDEO)    console.log(...args); };
export const vlogCw       = (...args: any[]) => { if (DEBUG_CW)       console.log(...args); };
export const vlogInfra    = (...args: any[]) => { if (DEBUG_INFRA)    console.log(...args); };
export const vlogSpectrum = (...args: any[]) => { if (DEBUG_SPECTRUM) console.log(...args); };

export type DebugFlags = {
  rig: boolean;
  audio: boolean;
  video: boolean;
  cw: boolean;
  infra: boolean;
  spectrum: boolean;
};

export const debugFlags: DebugFlags = {
  rig: DEBUG_RIG,
  audio: DEBUG_AUDIO,
  video: DEBUG_VIDEO,
  cw: DEBUG_CW,
  infra: DEBUG_INFRA,
  spectrum: DEBUG_SPECTRUM,
};
