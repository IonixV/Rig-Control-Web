# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Global Rules

- Always search for best practices from the latest online research. Don't invent or assume, and don't be a pleaser. Be honest and factual.
- Look at the whole plan from top to bottom. Leave no stone unturned.
- Ask clarifying questions if you aren't 100% sure how to do something. Do not make assumptions.

## Project Overview

RigControl Web (`v05.21.2026-Beta11`) is a full-stack web + Electron desktop application for controlling amateur radio equipment via Hamlib's `rigctld`. It provides a real-time dashboard with frequency/mode/meter display, bidirectional Opus audio, browser-native H.264 video streaming, POTA/SOTA/WWFF spot integration, a CW iambic keyer, a GGMorse-based CW decoder, solar/propagation data, and a user-configurable panel grid layout. All transport runs over HTTPS (self-signed EC P-256 certificate, auto-generated at startup).

## Commands

```bash
# Development
npm run dev              # Start Express + Socket.io backend (tsx server.ts)
npm run build            # Build Vite frontend to dist/
npm run lint             # TypeScript type-check (tsc --noEmit)
npm run test             # Run Vitest tests
npm run clean            # Remove dist/, dist-electron/, build/
npm run build:cw-helper  # Compile cw-key-helper.c for the current platform (scripts/build-cw-helper.mjs)

# Electron
npm run electron:dev     # Run as Electron desktop app in dev mode
npm run build:electron   # Bundle electron/main.ts and electron/preload.ts via esbuild
npm run electron:build   # Full Electron production build (frontend + electron + package)
```

There is no hot-reload for `server.ts` or any module under `server/` — restart manually after backend changes.

## Architecture

### Process Model

```
Browser / Electron Renderer
      ↕ Socket.io (WSS — HTTPS)
Express + Socket.io Server  (server.ts orchestrator + server/ modules)
      ↕ TCP socket         ↕ child_process.spawn   ↕ naudiodon (native)   ↕ child_process.spawn
   rigctld (Hamlib)         (unused — FFmpeg        libopus-node            cw-key-helper (C binary)
      ↕ Serial/USB           removed from all        (Opus codec)            DTR/RTS serial line
   Radio Hardware            paths)
```

**Video pipeline:** The Electron renderer (always the video source) captures via `getUserMedia` + `MediaStreamTrackProcessor`, encodes H.264 (AVCC, avc1.42001F / OpenH264 Baseline Profile) with `VideoEncoder`, and emits chunks through the Socket.io server. The server buffers the latest keyframe (with its AVCC SPS/PPS description) and relays all chunks to remote browser clients, which decode with `VideoDecoder` and render to a `<canvas>`. FFmpeg is **not** used in any path.

### Key Files — Backend

- **`server.ts`** — 269-line orchestrator. Wires together the 9 modules below and starts the HTTPS server.
- **`server/context.ts`** — `ServerContext` interface; the single shared-mutable-state object passed by reference to every module.
- **`server/tls.ts`** — Auto-generates/reuses an EC P-256 self-signed certificate covering `localhost` and all LAN IPs (required for `getUserMedia`/`setSinkId` in browser contexts).
- **`server/settings.ts`** — Reads/writes `settings.json`; emits `settings-data` on connect or change.
- **`server/rigctld.ts`** — Spawns and monitors the `rigctld` child process; buffers the last 100 log lines.
- **`server/rigComm.ts`** — Owns the TCP socket to `rigctld`; polls rig state every 2 s; implements `executeRigCommand` with extended-mode RPRT handling.
- **`server/audio.ts`** — Manages `naudiodon` I/O streams and `libopus-node` encode/decode; enforces last-interacted-wins mic policy via `activeAudioClientId`.
- **`server/cw.ts`** — Server-side iambic state machine (A/B/straight); drives DTR/RTS via the `cw-key-helper` C binary subprocess; 5 s stuck-key watchdog.
- **`server/video.ts`** — Relays WebCodecs H.264 chunks from the Electron source to remote clients; buffers the latest keyframe.
- **`server/solar.ts`** — Fetches solar/propagation data from hamqsl.com (HF band conditions, VHF phenomena, SFI, SSN); caches server-side and pushes `solar-data` events to clients.
- **`server/vlog.ts`** — Verbose-logging helper; gated by the `-v` / `--verbose` CLI flag.

### Key Files — Frontend

- **`src/App.tsx`** — ~987 lines, 2 `useState` calls. Thin composition root; assembles hooks and renders `CompactLayout` or `PhoneLayout` based on viewport width (≥768 px → Compact).
- **`src/hooks/`** — All business logic:
  - `useRigControl` — Socket.io rig commands and state
  - `useAudio` — `getUserMedia`, AudioWorklet, WebCodecs Opus decode/encode, GainNode volume
  - `useVideoStream` — WebCodecs H.264 encode (Electron source) and decode (remote clients)
  - `useCWKeyer` — Paddle event emission, sidetone (`AudioContext` oscillator), keyer settings
  - `useCwDecoder` — GGMorse WASM lifecycle, decoded text buffer, pitch/WPM stats
  - `usePotaSpots` — Browser-side POTA/SOTA/WWFF polling, deduplication, filtering
  - `useRigctld` — `rigctld` process control and log streaming
  - `useSolarData` — Receives `solar-data` events from server; triggers client-side refresh
  - `useLayoutState` — Viewport breakpoint and layout-level state
  - `usePanelState` — Per-panel collapse state
  - `useLayoutConfig` — Grid layout persistence to `localStorage`; `addPanel`, `removePanel`, `updateItemPositions`
- **`src/layouts/`** — `CompactLayout.tsx`, `PhoneLayout.tsx`, `PhoneStickyBar.tsx`. No Desktop layout (removed 2026-05-01).
- **`src/panels/`** — 15 panel components (each wrapped in `PanelChrome`): `VfoPanel`, `ControlsPanel`, `SMeterPanel`, `AlcPanel`, `SwrPanel`, `TabbedMeterPanel`, `RfLevelsPanel`, `ModeBwPanel`, `VideoAudioPanel`, `SpotsPanel`, `SpotComboPanel`, `CwDecodePanel`, `CommandConsolePanel`, `MufMapPanel`, `SolarPanel`.
- **`src/modals/`** — `SettingsModal.tsx` (tabs: RIGCTLD / SPOTS / KEYER), `VideoSettingsModal.tsx`, `SpotSettingsModal.tsx`, `ComboSpotSettingsModal.tsx`.
- **`src/components/PanelChrome.tsx`** — Shared collapsible/expandable wrapper with title and header-action slots; used by all panels.
- **`src/components/EditToolbar.tsx`** — Fixed toolbar rendered during compact/phone layout edit mode. Cols/rows ± controls, Add Panel, Reset, and Done buttons. `showRowsControl` prop gates the size controls (phone view omits them).
- **`src/components/PanelPicker.tsx`** — Two-step modal for adding panels. Step 1 lists available panel types (already-placed panels greyed out). Step 2 (for panels with `PANEL_CONFIG_OPTIONS` entries, e.g. `mufmap`) shows a height slider and Full Width toggle before confirming.
- **`public/audio-processor.js`** — Static file loaded by `AudioWorklet.addModule()`. Defines two `AudioWorkletProcessor` classes: `PlaybackProcessor` (inbound jitter buffer, 60 ms min / 240 ms max at 48 kHz) and `CaptureProcessor` (posts mic PCM frames to the main thread). Must be a static URL-addressable file; cannot be bundled.
- **`cw-key-helper.c`** — C source for the CW keyer serial line helper. Compiled to `bin/linux/cw-key-helper`, `bin/mac/cw-key-helper`, and `bin/windows/cw-key-helper.exe` per platform. Spawned by `server/cw.ts` (`openKeyerPort`) to drive DTR or RTS. Opens the port with `O_RDWR | O_NOCTTY | O_NONBLOCK`, configures raw termios (no flow control, `HUPCL` cleared), deasserts the line before printing `OPEN_OK`, then reads `0`/`1` from stdin and toggles the line via `TIOCMBIS`/`TIOCMBIC` (POSIX) or `EscapeCommFunction` (Windows). Replaces the Python/`pyserial` approach; the Node.js `serialport` package asserts DTR before JS can run on Linux with CP210x adapters, causing stuck-key failures. Run `npm run build:cw-helper` to compile for the local platform in dev.
- **`cw-key-helper.py`** — Original Python/`pyserial` helper. **Superseded by `cw-key-helper.c`**; retained for reference only. No longer bundled or spawned.
- **`src/types/solar.ts`** — TypeScript interfaces for solar/propagation data: `HfBandCondition`, `VhfCondition`, `SolarData` (SFI, SSN, A/K-index, X-ray, geomagnetic field, solar wind, aurora, proton/electron flux).
- **`electron/main.ts`** — Electron main process; spawns the Express server, manages `BrowserWindow`, grants camera/mic permissions. Calls `setElectronWindow(win)` and `shutdown()` exported from `server.ts` for lifecycle management.
- **`electron/preload.ts`** — Exposes `window.electron.resizeWindow(width, height)` via `contextBridge`.
- **`radios.json`** — Bundled read-only Hamlib radio model database. Do not modify.
- **`settings.json`** — Auto-created user settings (gitignored). In Electron production, falls back to `/tmp/settings.json`.

### Socket.io Configuration

Per-message deflate compression (`perMessageDeflate: false`) is explicitly disabled on the Socket.io server. The app sends high-frequency binary payloads (audio chunks every 20 ms, video frames continuously); compression would add CPU overhead and latency with negligible bandwidth benefit for already-encoded binary data.

`server.ts` exports `setElectronWindow(win)` and `shutdown()` for Electron lifecycle management. `setElectronWindow` passes the `BrowserWindow` reference so the server can send resize/IPC events; `shutdown()` performs graceful teardown (kills `rigctld`, closes naudiodon streams, closes the HTTPS server) when the Electron window closes. In standalone server mode, `SIGINT`/`SIGTERM` handlers cover the same teardown path.

### Socket.io Communication Patterns

**Client → Server (commands):**
- Rig control: `connect-rig`, `set-frequency`, `set-mode`, `set-ptt`, `set-func`, `set-level`, `set-split-vfo`, `vfo-op`, `send-raw`
- Process control: `start-rigctld`, `stop-rigctld`, `kill-existing-rigctld`, `test-rigctld`
- Settings: `save-settings`, `toggle-auto-start`, `get-settings`
- Video: `control-video`, `update-video-settings`, `get-video-devices`
- Audio: `control-audio`, `update-audio-settings`, `audio-outbound`, `get-audio-devices`
- CW: `cw-paddle` (`{ dit, dah, straight, t }` — client-relative timestamps)
- Solar: `get-solar-data`

**Server → Client (state):**
- `rig-status` — Polled every 2 s: frequency, mode, PTT, VFO state, meters
- `rig-connected` — Includes `{ vfoSupported }` flag from VFO capability probe
- `rigctld-status`, `rigctld-log` — Process health and buffered log (last 100 lines)
- `audio-inbound` — PCM/Opus packets from radio to browser
- `settings-data` — Full settings object on connect or change
- `video-chunk` — Encoded H.264 chunks relayed to remote clients
- `solar-data` — HF band conditions, VHF phenomena, SFI, SSN from hamqsl.com
- `verbose-mode` — Mirrors server `-v` flag to browser clients

### Audio Pipeline

- **Outbound (browser → radio):** Browser `getUserMedia` → `AudioWorklet` (`CaptureProcessor` in `public/audio-processor.js`) → 48 kHz mono PCM frames (960 samples / 20 ms) → `libopus-node` encoder on server → `naudiodon` playback. An outbound jitter buffer (sole writer via 20 ms `setInterval`) prevents concurrent-write packet loss on Windows.
- **Inbound (radio → browser):** `naudiodon` capture → `libopus-node` encoder → Socket.io `audio-inbound` → Browser WebCodecs `AudioDecoder` → `AudioWorklet` (`PlaybackProcessor` in `public/audio-processor.js`, jitter buffer 60 ms min / 240 ms max) → `GainNode` (0–200% volume) → `AudioContext.destination`.
- Inbound PCM is also fed to `GGMorseDecoder.processSamples()` when CW decoding is enabled, regardless of mute state.
- Multi-client mic uses "last-interacted-wins" policy tracked via `activeAudioClientId`. Persistent `clientId` (localStorage UUID, passed via `socket.handshake.auth`) survives reconnects.
- `naudiodon` is a forked dependency (`github:jbdubbs/naudiodon-gcc15`) patched for GCC 15 compatibility.

### Video Pipeline

- **Source (Electron only):** `getUserMedia` → `MediaStreamTrackProcessor` → `VideoEncoder` (avc1.42001F, AVCC) → Socket.io `video-chunk` events.
- **Relay (server):** Buffers latest keyframe + its AVCC description (`EncodedVideoChunkMetadata.decoderConfig.description`). On client connect, sends the buffered keyframe first so the decoder can configure immediately.
- **Sink (remote browsers):** `VideoDecoder` → `<canvas>` via `VideoFrame.copyTo` or `ImageBitmap`.
- FFmpeg is not involved in video.

### Panel System

All functional UI sections live in `src/panels/` as independent components, each wrapped in `PanelChrome` for consistent collapsible/expandable chrome with a title and optional header-action slot.

**Compact layout** uses a segment-based column renderer (`useLayoutConfig`): full-width panels (`w >= cols`) render as rows; per-column panels form `grid-cols-N` stacks that take only the vertical space their content needs. Layout mutations (drag, resize, add, remove, cols/rows) persist to `localStorage`. The `EditToolbar` and `PanelPicker` (two-step for configurable panels like `mufmap`) drive grid edits.

**Phone layout** renders panels sorted by `y`-value from `phoneLayout.items`. Edit mode shows ▲ ▼ × overlays for reordering. `PanelPicker` is restricted to `PHONE_PANEL_TYPES`.

### Spots Integration

POTA, SOTA, and WWFF spots are fetched **browser-side** via `setInterval` (no server relay). Each spot type: deduplicates by activator, applies age/mode/band filters, and supports click-to-tune (SSB resolves to USB/LSB by the 10 MHz ITU boundary). Settings persisted to `settings.json`. Available as individual panels (`spots_pota`, `spots_sota`, `spots_wwff`) or the unified `spots_combo` panel (`SpotComboPanel` with `ComboSpotSettingsModal`).

### Solar / Propagation Data

`server/solar.ts` fetches HF band conditions, VHF phenomena, SFI, and SSN from `hamqsl.com/solarxml.php` server-side (with a 1-hour cache) and pushes `solar-data` events to clients. `SolarPanel` displays HF band condition rows (day/night) and VHF propagation alerts. `useSolarData` hook manages client-side state.

### MUF Map Panel

`MufMapPanel` embeds SVG world propagation maps from `prop.kc2g.com` (MUFD or foF2). Supports scroll-to-zoom (cursor-anchored), drag, and pinch-to-zoom. Uses `width/height = scale * 100%` on the image wrapper for crisp SVG rasterization. Height is configured at panel-add time via the two-step `PanelPicker` config flow and stored in `GridItem.heightPx`.

### CW Keyer

Server-side iambic state machine (A/B/straight) in `server/cw.ts`. Client sends `cw-paddle { dit, dah, straight, t }` events where `t` is ms since socket connect (computed via `performance.now() - cwConnectTimeRef`) to decouple element timing from network jitter. Keying output via DTR or RTS through the `cw-key-helper` C binary subprocess (`bin/<platform>/cw-key-helper[.exe]`); `rigctld-ptt` mode also supported. 5 s stuck-key watchdog. Client-side sidetone (`AudioContext` oscillator, routed via `setSinkId`) provides zero-latency local feedback gated on `localAudioReady`. Phone view shows dit/dah touch paddle buttons when rig is in a CW mode and the keyer is enabled.

The C binary is compiled from `cw-key-helper.c` and placed in the platform `bin/` directory. `getCwHelperPath()` in `server/cw.ts` resolves the path using the same pattern as `getRigctldPath()` in `server/rigctld.ts`. In CI (`build.yml`), the binary is compiled before `npm run electron:build` on each platform runner so it is always bundled in the AppImage/DMG/NSIS installer. `bin/**/*` is in `asarUnpack`, so the binary is accessible at runtime outside the ASAR archive.

### CW Decoder

GGMorse library compiled to WASM (`public/ggmorse.js` / `public/ggmorse.wasm`) via Emscripten. `GGMorseDecoder` class (`src/ggmorseDecoder.ts`) loads WASM lazily on first enable and exposes `processSamples(Float32Array)` and `reset()`. Fed raw F32 PCM from the inbound audio path after WebCodecs decoding — runs even when the speaker is muted. Decoded characters stream into a 2000-char rolling buffer; pitch (Hz) and WPM stats shown alongside. Toggle in the KEYER settings tab.

### Native Modules

Native `.node` addons (`naudiodon`) and `.wasm` files (`libopus-node`, `ggmorse`) must be excluded from bundling. In Electron builds they are ASAR-unpacked via `asarUnpack` in `package.json`. In server code, native modules are loaded via dynamic `import()` to bypass esbuild.

### HTTPS / TLS

`server/tls.ts` (`loadOrGenerateCert()`) auto-generates an EC P-256 self-signed certificate at startup, covering `localhost`, `127.0.0.1`, and all current LAN IPv4 addresses in the SAN. Reused if valid for 30+ days and all IPs are still covered; otherwise regenerated. Required so that `getUserMedia` and `setSinkId` work in browser tabs opened to LAN IPs. Certificate files are gitignored.

### Settings Persistence

`settings.json` is read/written by the server via `server/settings.ts`. Fields include: `rigNumber`, `serialPort`, `baudRate`, `rigctldAutoStart`, `pollRate`, video settings, audio device settings, POTA/SOTA/WWFF settings, CW keyer settings. The `radios.json` file is read-only; do not modify it.

### Electron IPC

- `nodeIntegration: false`, `contextIsolation: true` — renderer has no direct Node access.
- Preload exposes only `window.electron.resizeWindow(width, height)`.
- Camera/microphone permissions granted via `setPermissionRequestHandler`.
- `app.setName('RigControl Web')` called before `whenReady()` to set a predictable `WM_CLASS` for GNOME.
- Linux AppImage supports `--install` / `--uninstall` CLI flags for GNOME desktop integration (copies icon + writes `.desktop` file; exits before `app.whenReady()`).

## Known Issues / Tech Debt

- `rigctld` binary is assumed to be in system PATH (or `bin/[platform]/rigctld` in Electron builds).
- Split VFO support depends on the specific radio model configured in `rigctld`.
- Port conflict: if `rigctld` is already running on the same port externally, the spawned process will fail (error shown in log view).
- Some radios (e.g. FT-891) return `RPRT -11` for certain commands in incompatible modes (e.g. NB in FM). These are handled gracefully as immediate rejections; no socket destruction occurs.
- Verify `rigctld` binary availability in the production Electron environment.
