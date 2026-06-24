# WSJTX Integration

Operate FT8, FT4, JT65, WSPR, and other digital modes via WSJTX while controlling your radio remotely through RigControl Web.

---

## How It Works

```
WSJTX ──TCP (rigctld)──→ wsjtx-bridge (localhost)
                               ↕ WebSocket
                          Browser Tab
                               ↕ Socket.io (WSS)
                          RigControl Web Server
                               ↕ TCP
                             rigctld → Radio
```

**Rig control** flows through a local `wsjtx-bridge` helper binary that speaks the Hamlib rigctld protocol to WSJTX and relays commands to RigControl Web via the browser's existing encrypted connection. rigctld is never exposed to the network.

**Audio** is routed through virtual audio cables:
- **RX:** server → browser → virtual cable → WSJTX (for decoding)
- **TX:** WSJTX → virtual cable → browser mic capture → server → radio

---

## Prerequisites

- RigControl Web running and connected to your radio
- WSJTX installed on your local machine (the same machine running the browser)
- Virtual audio cables (see platform-specific setup below)
- Chrome or Edge browser (required for `setSinkId` audio routing)

---

## Step 1: Virtual Audio Setup

### Linux (fully automated)

No manual setup needed. The `wsjtx-bridge` helper automatically creates virtual audio devices via PipeWire (`pw-loopback`) on startup and removes them on exit. Requires PipeWire (standard on Fedora, Ubuntu 22.04+, and most modern distros).

Use `--no-audio` to skip automatic virtual audio creation if you prefer to manage devices manually.

### macOS

Install [BlackHole](https://github.com/ExistentialAudio/BlackHole) (free, open-source):

```bash
brew install blackhole-2ch
```

BlackHole provides a single 2-channel virtual audio device. You may need a second virtual device for the TX path — install `blackhole-16ch` or use [Loopback](https://rogueamoeba.com/loopback/) if you need two independent cables.

### Windows

Two virtual audio cables are required for bidirectional audio (RX and TX paths). RigControl Web auto-detects the following VB-Audio products:

**Option A — Two free cables (recommended):**
1. Install [VB-CABLE](https://vb-audio.com/Cable/) (free/donationware)
2. Install [Hi-Fi CABLE & ASIO Bridge](https://vb-audio.com/Cable/) (free/donationware, separate download)

**Option B — Donation bundle:**
1. Install [VB-CABLE A+B](https://vb-audio.com/Cable/) (donationware, ~5 EUR)

Auto-setup assigns the first detected cable as **RX** (browser → WSJTX) and the second as **TX** (WSJTX → browser). Detection priority: VB-CABLE → Hi-Fi CABLE → Cable A → Cable B → Cable C → Cable D.

**Device names with Option A (VB-CABLE + Hi-Fi CABLE):**

| Cable | Playback device (audiooutput) | Recording device (audioinput) |
|-------|-------------------------------|-------------------------------|
| RX | `CABLE Input (VB-Audio Virtual Cable)` | `CABLE Output (VB-Audio Virtual Cable)` |
| TX | `Hi-Fi Cable Input (VB-Audio Hi-Fi Cable)` | `Hi-Fi Cable Output (VB-Audio Hi-Fi Cable)` |

**Device names with Option B (VB-CABLE A+B):**

| Cable | Playback device (audiooutput) | Recording device (audioinput) |
|-------|-------------------------------|-------------------------------|
| RX | `CABLE-A Input (VB-Audio Cable A)` | `CABLE-A Output (VB-Audio Cable A)` |
| TX | `CABLE-B Input (VB-Audio Cable B)` | `CABLE-B Output (VB-Audio Cable B)` |

> **Note:** VB-CABLE and Hi-Fi CABLE are both donationware — free to use with an optional donation to the developer. VB-CABLE A+B is also donationware, available for a suggested donation of ~5 EUR.

---

## Step 2: Start the Helper

Run the `wsjtx-bridge` binary on your local machine:

```bash
./wsjtx-bridge          # Linux
./wsjtx-bridge          # macOS
wsjtx-bridge.exe        # Windows
```

On Linux you should see:
```
READY 4540 4541
wsjtx-bridge: Virtual audio devices created (PipeWire)
  WSJTX Soundcard Input:   RCW-WSJTX-RX
  WSJTX Soundcard Output:  RCW-WSJTX-TX
  RCW WSJTX Audio Output:  RCW-WSJTX-RX
  RCW Local Input (Mic):   RCW-WSJTX-TX
```

The helper listens on:
- **TCP port 4540** — rigctld protocol for WSJTX
- **WebSocket port 4541** — JSON protocol for the browser

Custom ports: `wsjtx-bridge --tcp-port 4550 --ws-port 4551`

---

## Step 3: RigControl Web Configuration

Open Audio Settings in RigControl Web:

1. **Enable WSJTX Bridge** — toggle on in the WSJTX / Digital Mode Bridge section. The status should show "Connected" (green) if the helper is running.

2. **Audio auto-setup** — on Linux and Windows, audio devices are auto-configured when the bridge connects. The status banner shows "Auto-configured" (green) when successful. If auto-setup fails, configure manually:

   **WSJTX Audio Output** (RX cable — browser plays radio audio here):
   - Linux: `RCW-WSJTX-RX` (auto-detected)
   - macOS: `BlackHole 2ch`
   - Windows: `CABLE Input (VB-Audio Virtual Cable)` (auto-detected)

   **Local Input (Microphone)** (TX cable — captures WSJTX transmitted audio):
   - Linux: `RCW-WSJTX-TX` (auto-detected)
   - macOS: Second BlackHole device or loopback
   - Windows: `Hi-Fi Cable Output (VB-Audio Hi-Fi Cable)` (auto-detected)

3. **Unmute your mic** when ready to transmit via WSJTX.

> **Important:** You must manually click "Join Audio" before auto-setup takes effect. Browser autoplay policy prevents programmatic audio context creation without a user gesture.

---

## Step 4: WSJTX Configuration

In WSJTX → Settings → **Radio:**
- **Rig:** Hamlib NET rigctl
- **Network Server:** `localhost:4540`
- **PTT Method:** CAT (or RIG — both work through the bridge)

In WSJTX → Settings → **Audio:**

| Setting | Linux | macOS | Windows (VB-CABLE + Hi-Fi) | Windows (A+B) |
|---------|-------|-------|---------------------------|---------------|
| **Soundcard Input** (hears radio) | `RCW-WSJTX-RX` | `BlackHole 2ch` | `CABLE Output (VB-Audio Virtual Cable)` | `CABLE-A Output (VB-Audio Cable A)` |
| **Soundcard Output** (transmits) | `RCW-WSJTX-TX` | Second BlackHole device | `Hi-Fi Cable Input (VB-Audio Hi-Fi Cable)` | `CABLE-B Input (VB-Audio Cable B)` |

---

## Testing

1. Tune to **14.074 MHz USB** (FT8 calling frequency)
2. Wait for a 15-second decode window
3. Verify FT8 signals appear in WSJTX's waterfall and decode list
4. Try a test CQ — verify PTT engages, audio transmits, and PTT releases

---

## Troubleshooting

**Bridge shows "Waiting" (yellow)**
- Is `wsjtx-bridge` running? Check for `READY 4540 4541` in its output.
- Is the WebSocket port correct? Default is 4541.
- Chrome/Edge only — Firefox and Safari have limited `setSinkId` support.

**No audio in WSJTX waterfall**
- Is the WSJTX Audio Output device set in RigControl Web?
- Is the backend audio engine started and playing?
- Check the volume — the WSJTX output bypasses mute/volume controls, but the backend must be streaming audio.

**WSJTX can't connect to rig**
- Verify `wsjtx-bridge` is running and shows `READY`.
- In WSJTX, ensure Rig is "Hamlib NET rigctl" and server is `localhost:4540`.
- Check for port conflicts — another program may be using port 4540.

**PTT doesn't engage**
- Verify the rig is connected in RigControl Web (frequency/mode showing).
- Check that WSJTX's PTT method is set to CAT.

**Windows: "Only one virtual cable detected"**
- You need two VB-Audio cables installed. Install Hi-Fi CABLE (free) alongside VB-CABLE, or donate for VB-CABLE A+B.

**Windows: "Virtual audio cables not detected"**
- Install VB-CABLE and Hi-Fi CABLE from [vb-audio.com](https://vb-audio.com/Cable/), or donate for VB-CABLE A+B.
- Restart the browser after installing new audio drivers.

**Audio latency / missed decodes**
- Network audio adds ~100-300 ms depending on your connection. WSJTX compensates internally, but high-latency or lossy connections may affect decode rates.
- For best results, use a wired LAN connection to the RigControl Web server.
