import { spawn, execSync, type ChildProcess } from 'child_process';

// PipeWire loopback for AudioFeedPanel/SpectrumAudioPanel/CwDecodePanel e2e
// coverage — gives server/audio.ts's naudiodon a real device to open in a
// hardware-less environment. No PulseAudio server/pactl involved: pw-loopback
// is the same tool wsjtx-bridge.c already spawns in production
// (spawn_pw_loopback, wsjtx-bridge.c:962-989) — this mirrors that exact
// --capture-props/--playback-props shape for a differently-named node.
// `wpctl` (WirePlumber's own CLI, not PulseAudio) makes the loop's source
// the system default source, which is what unblocks the capture side below.
//
// Topology (same as wsjtx-bridge's RX loop): naudiodon's OUTPUT plays into
// the capture side (presented as a Sink), which loops back out the paired
// ".output" playback side (presented as a Source) that naudiodon's INPUT
// reads from.
const NODE_NAME = 'rcw_test_audio_loop';
const DESCRIPTION = 'RCW-Test-Loop';

// Confirmed empirically: naudiodon's PulseAudio host API device `name` is
// PipeWire's `node.name` (the pw-loopback --capture-props/--playback-props
// value), NOT `node.description` — a pw-loopback capture side named
// `rcw_test_audio_loop` (media.class=Audio/Sink, what naudiodon plays INTO)
// shows up as an output-only device by that exact name. Opening it directly
// works fine and instantly.
export const LOOPBACK_OUTPUT_NAME = NODE_NAME;

// The paired playback side (`rcw_test_audio_loop.output`, media.class=
// Audio/Source, what naudiodon should capture FROM) is registered by
// PipeWire as a "Filter", not a plain Source — confirmed empirically that
// naudiodon's AudioIO constructor hangs indefinitely (not an error, a true
// hang, reproduced in isolation outside Playwright/naudiodon's PulseAudio
// host API) when targeting it by that name directly. What DOES work:
// making it the WirePlumber default source, then opening naudiodon's
// generic ALSA "pipewire" passthrough device (present whenever PipeWire's
// ALSA plugin is installed) instead of the named node — a different
// PortAudio code path that doesn't hit the same hang.
export const LOOPBACK_INPUT_NAME = 'pipewire';

let child: ChildProcess | null = null;
let previousDefaultSourceId: string | null = null;

// Parses `wpctl status`'s first "Sources:" section (audio; there's a
// second one further down for video capture devices) and returns the id of
// whichever line is marked with the leading `*` (the current default), or
// null if none is marked.
function getDefaultAudioSourceId(): string | null {
  const status = execSync('wpctl status').toString();
  const sourcesSection = status.split(/├─ Sources:/)[1]?.split(/├─|└─/)[0] ?? '';
  const match = sourcesSection.match(/\*\s+(\d+)\./);
  return match ? match[1] : null;
}

function findLoopbackSourceNodeId(): string {
  const status = execSync('wpctl status').toString();
  const match = status.match(new RegExp(`(\\d+)\\.\\s+${NODE_NAME}\\.output`));
  if (!match) throw new Error(`wpctl status: could not find ${NODE_NAME}.output node id`);
  return match[1];
}

// How long pw-loopback takes to register its nodes with PipeWire varies with
// runner load (confirmed flaky on CI: a single fixed post-spawn delay was
// sometimes too short and failed the whole e2e job before any test ran).
// Poll instead of guessing one delay.
function pollForLoopbackSourceNodeId(timeoutMs = 5000, intervalMs = 100): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      try {
        resolve(findLoopbackSourceNodeId());
      } catch (err) {
        if (Date.now() >= deadline) {
          reject(err);
        } else {
          setTimeout(attempt, intervalMs);
        }
      }
    }
    attempt();
  });
}

export function startAudioLoopback(): Promise<void> {
  return new Promise((resolve, reject) => {
    // audio.rate=48000: without it, PipeWire defaults these nodes to 44100,
    // mismatching the 48000 server/audio.ts's naudiodon AudioIO always
    // requests (see startAudio()) — confirmed empirically this makes the
    // difference between the naudiodon output stream actually opening vs.
    // hanging.
    const captureProps = `node.name=${NODE_NAME} node.description=${DESCRIPTION} media.class=Audio/Sink audio.rate=48000`;
    const playbackProps = `node.name=${NODE_NAME}.output node.description=${DESCRIPTION} media.class=Audio/Source audio.rate=48000`;

    const proc = spawn('pw-loopback', [
      '--channels', '1',
      '--channel-map', 'MONO',
      '--capture-props', captureProps,
      '--playback-props', playbackProps,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let settled = false;
    proc.once('error', (err) => {
      if (!settled) { settled = true; reject(err); }
    });
    proc.once('spawn', () => {
      child = proc;
      pollForLoopbackSourceNodeId()
        .then((sourceId) => {
          try {
            previousDefaultSourceId = getDefaultAudioSourceId();
            execSync(`wpctl set-default ${sourceId}`);
            if (!settled) { settled = true; resolve(); }
          } catch (err) {
            if (!settled) { settled = true; reject(err); }
          }
        })
        .catch((err) => {
          if (!settled) { settled = true; reject(err); }
        });
    });
  });
}

export function stopAudioLoopback(): Promise<void> {
  return new Promise((resolve) => {
    if (previousDefaultSourceId) {
      try { execSync(`wpctl set-default ${previousDefaultSourceId}`); } catch { /* best-effort */ }
      previousDefaultSourceId = null;
    }
    if (!child) { resolve(); return; }
    const proc = child;
    child = null;
    proc.once('exit', () => resolve());
    proc.kill('SIGTERM');
    // pw-loopback should exit promptly on SIGTERM; don't hang teardown if it doesn't.
    setTimeout(resolve, 2000);
  });
}
