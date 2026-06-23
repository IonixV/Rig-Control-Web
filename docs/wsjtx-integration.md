# WSJTX Integration Guide

Operate FT8, FT4, JT65, WSPR, and other digital modes via WSJTX while
controlling your radio remotely through RigControl Web.

## Architecture

```
WSJTX ──TCP (rigctld)──→ wsjtx-bridge (localhost)
                               ↕ WebSocket
                          Browser Tab
                               ↕ Socket.io (WSS)
                          RigControl Web Server
                               ↕ TCP
                             rigctld → Radio
```

**Rig control** flows through a local `wsjtx-bridge` helper binary that speaks
the Hamlib rigctld protocol to WSJTX and relays commands to RigControl Web via
the browser's existing encrypted connection.  rigctld is never exposed to the
network.

**Audio** is routed through virtual audio cables:
- RX: server → browser → virtual cable → WSJTX (for decoding)
- TX: WSJTX → virtual cable → browser mic capture → server → radio

## Prerequisites

- RigControl Web running and connected to your radio
- WSJTX installed on your local machine (the same machine running the browser)
- Virtual audio cables (see platform-specific setup below)
- Chrome or Edge browser (required for `setSinkId` audio routing)

## Step 1: Virtual Audio Setup

### Linux (fully automated)

```bash
./scripts/setup-virtual-audio.sh
```

This creates two PulseAudio/PipeWire null sinks.  No third-party software
needed.  To remove them later:

```bash
./scripts/setup-virtual-audio.sh teardown
```

### macOS

Install [BlackHole](https://github.com/ExistentialAudio/BlackHole) (free,
open-source):

```bash
brew install blackhole-2ch
```

BlackHole provides a single 2-channel virtual audio device.  You may need a
second virtual device for the TX path — install `blackhole-16ch` or use
[Loopback](https://rogueamoeba.com/loopback/) if you need two independent
cables.

### Windows

Install [VB-Audio Virtual Cable](https://vb-audio.com/Cable/) (free).  The
installer creates `CABLE Input` and `CABLE Output` devices.  For a second
cable (TX path), download VB-Cable A+B from the same site.

## Step 2: Start the Helper

Run the `wsjtx-bridge` binary on your local machine:

```bash
# From the RigControl Web directory
./bin/linux/wsjtx-bridge          # Linux
./bin/mac/wsjtx-bridge            # macOS
bin\windows\wsjtx-bridge.exe      # Windows
```

You should see:
```
READY 4540 4541
```

The helper listens on:
- **TCP port 4540** — rigctld protocol for WSJTX
- **WebSocket port 4541** — JSON protocol for the browser

Custom ports: `wsjtx-bridge --tcp-port 4550 --ws-port 4551`

## Step 3: RigControl Web Configuration

Open Audio Settings in RigControl Web:

1. **Enable WSJTX Bridge** — toggle on in the WSJTX / Digital Mode Bridge
   section.  The status should show "Connected" (green) if the helper is
   running.

2. **WSJTX Audio Output** — select the virtual cable that WSJTX will read
   from.  Virtual cables are marked with ★ in the dropdown.
   - Linux: `RCW-WSJTX-RX`
   - macOS: `BlackHole 2ch`
   - Windows: `CABLE Input (VB-Audio Virtual Cable)`

3. **Local Input (Microphone)** — set to the virtual cable that WSJTX writes
   to.
   - Linux: `Monitor of RCW-WSJTX-TX`
   - macOS: Second BlackHole device or loopback
   - Windows: Second VB-Cable output

4. **Unmute your mic** when ready to transmit via WSJTX.

## Step 4: WSJTX Configuration

In WSJTX → Settings → Radio:
- **Rig:** Hamlib NET rigctl
- **Network Server:** `localhost:4540`
- **PTT Method:** CAT (or RIG — both work through the bridge)

In WSJTX → Settings → Audio:
- **Soundcard Input:**
  - Linux: `Monitor of RCW-WSJTX-RX`
  - macOS: `BlackHole 2ch`
  - Windows: `CABLE Output (VB-Audio Virtual Cable)`
- **Soundcard Output:**
  - Linux: `RCW-WSJTX-TX`
  - macOS: Second BlackHole device
  - Windows: Second VB-Cable input

## Testing

1. Tune to **14.074 MHz USB** (FT8 calling frequency)
2. Wait for a 15-second decode window
3. Verify FT8 signals appear in WSJTX's waterfall and decode list
4. Try a test CQ — verify PTT engages, audio transmits, and PTT releases

## Troubleshooting

**Bridge shows "Waiting" (yellow)**
- Is `wsjtx-bridge` running?  Check for `READY 4540 4541` in its output.
- Is the WebSocket port correct?  Default is 4541.
- Chrome/Edge only — Firefox and Safari have limited `setSinkId` support.

**No audio in WSJTX waterfall**
- Is the WSJTX Audio Output device set in RigControl Web?
- Is the backend audio engine started and playing?
- Check the volume — the WSJTX output bypasses mute/volume controls, but the
  backend must be streaming audio.

**WSJTX can't connect to rig**
- Verify `wsjtx-bridge` is running and shows `READY`.
- In WSJTX, ensure Rig is "Hamlib NET rigctl" and server is `localhost:4540`.
- Check for port conflicts — another program may be using port 4540.

**PTT doesn't engage**
- Verify the rig is connected in RigControl Web (frequency/mode showing).
- Check that WSJTX's PTT method is set to CAT.

**Audio latency / missed decodes**
- Network audio adds ~100-300 ms depending on your connection.  WSJTX
  compensates internally, but high-latency or lossy connections may affect
  decode rates.
- For best results, use a wired LAN connection to the RigControl Web server.
