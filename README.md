# RigControl Web

A web-first app for controlling your radio and making CW and SSB contacts!  

- Full support for making voice and CW contacts (FT8 coming soon)
- CW keyer in iambic and straight modes (via keyboard, "vBand adapter", or Tiny MIDI).  You can send real CW!  Not macros!
- Audio via your radio's virtual USB Audio Device, Digirig or similar.  
- Spectrum scope available on supported Icom radios (IC-7300, IC-7300MK2, IC-7610, IC-7850/7851, IC-705, IC-9700, IC-905) and the Yaesu FT-710.
- Video support so you can see the front panel of your radio (by feeding DVI/HDMI into your PC with an HDMI to USB capture dongle).

## Getting Started

**Most users should download the latest pre-built installer from the [Releases page](https://github.com/jbdubbs/Rig-Control-Web/releases).** Pick the installer for your operating system (Windows `.exe`, Linux `.AppImage`, or macOS `.dmg`), run it, and you are ready to go — no Node.js, no build tools required.

> **macOS users:** The `.dmg` is unsigned (no Apple Developer ID certificate). macOS Gatekeeper will block it on first launch. To open it: right-click (or Control-click) the app in Finder and choose **Open**, then click **Open** in the dialog. You only need to do this once.

For full usage instructions, see the **[Wiki](https://github.com/jbdubbs/Rig-Control-Web/wiki)**.

Developers who want to run from source will find build instructions in the [Development](#development) and [Desktop App (Electron)](#desktop-app-electron) sections below.

## Screenshots

### Compact View (Desktop)
![RigControl Web — Compact View](assets/1.0.0.screenshots/compact-view-1.0.0.png)

### Phone View (Mobile)
<img src="assets/1.0.0.screenshots/phone%20view%2006.11.2026.png" alt="RigControl Web — Phone View" width="50%">

## Features

- **User Authentication**: Every browser client must log in before accessing any controls. JWT-based, bcrypt-hashed passwords, per-user layout namespacing, and a full admin panel for user management, session monitoring, and an audit log.
- **Real-time Dashboard**: Frequency, mode, and meter displays (S-Meter, SWR, ALC, Power, VDD) polled live from the rig.
- **Spectrum Scope**: Live panadapter and waterfall display. Two independent source modes:
  - **Hamlib UDP** (Icom IC-7300, IC-7300MK2, IC-7610, IC-7850/7851, IC-705, IC-9700, IC-905): Receives spectrum data from Hamlib's built-in UDP multicast stream. Requires 115200 baud serial speed, CI-V Transceive OFF, and CI-V USB Echo ON in radio settings.
  - **FT-710 via USB** (Yaesu FT-710 only): Reads spectrum data directly from the radio's built-in FTDI FT4222H USB-to-SPI chip — a dedicated second USB device separate from the CAT serial port. Enable the radio's OPERATION SETTING → GENERAL → SCU-LAN10: ON to activate the chip; no physical SCU-LAN10 hardware is required. Requires `libft4222` from FTDI to be installed on the host. See [docs/ft4222-spectrum-setup.md](docs/ft4222-spectrum-setup.md) for full setup instructions. (The FTDX101 and FTDX10 are SCU-LAN10 compatible but route spectrum over Ethernet via the physical SCU-LAN10 device — that path is not supported.)
    - **Span control**: A 10-button span selector (1 kHz – 1 MHz) in the Spectrum Scope settings modal sends the span change command directly to the radio via `rigctld`. A live readout shows the span currently reported by incoming frame data.
  - Select the source and enable the scope in the **Spectrum Scope** panel settings (gear icon).
- **Bidirectional Audio**: Full transmit and receive audio over the network using the Opus 1.5 codec. Works for remote SSB, AM, and FM contacts.
  - Multi-client support.
  - Audio device lists show the host API (MME, DirectSound, WASAPI, ALSA, Pipewire/PulseAudio) and native sample rate so you can pick the right entry for your hardware.
  - **Rig Video Feed**: Display a system video capture device (e.g. HDMI capture card or webcam) so you can see your radio's front panel remotely. Example: FT-710 DVI out → USB HDMI capture card.
- **CW Keyer**: Full iambic (A/B) and straight-key CW keying from any browser or the Electron app.
  - Configurable WPM, keying method (DTR, RTS, or rigctld-PTT), serial port, and iambic mode.
  - Rebindable keyboard keys. Instant local sidetone via Web Audio — no latency from the network.
  - On phone/tablet, dedicated dit (·) and dah (—) touch paddle buttons replace the PTT bar when the rig is in CW mode.
- **CW Decoder**: Real-time Morse code decoding of received audio using the [GGMorse](https://github.com/ggerganov/ggmorse) library.
  - Enable by adding the **CW Decoder** panel to your layout via the **Add Panel** button. Decoded text streams into a scrolling display.
  - Shows estimated signal pitch (Hz) and speed (WPM) alongside decoded text.
- **Live Spots (POTA, SOTA, WWFF)**: Real-time spot displays, each independently enable/disable with configurable poll intervals.
  - Filterable by mode (SSB, CW, FT8, FT4) and band (multi-select). Configurable maximum spot age.
  - Sortable columns. Click any spot to instantly tune the VFO and set the mode.
- **Solar & Propagation Data**: Live HF band conditions, VHF propagation alerts, and detailed solar indices — all in one panel.
  - Data sourced from [hamqsl.com](https://www.hamqsl.com/) (N0NBH) with a 1-hour server-side cache; manual refresh available.
  - Three tabs: **HF** (band conditions + SFI/SN/A/K at a glance), **VHF** (aurora, Es, tropo, MS conditions by region), **SOLAR/GEO** (full solar flux, sunspot, geomagnetic, X-ray, and noise indices). eSFI and eSSN from [prop.kc2g.com](https://prop.kc2g.com/) (KC2G/WWROF/GIRO) shown when available.
- **MUF / foF2 World Map**: Zoomable SVG world propagation map embedded from [prop.kc2g.com](https://prop.kc2g.com/).
  - Switch between **MUFD** (Maximum Usable Frequency for a 3000 km path) and **foF2** (F2 layer critical frequency).
  - Time slots: **Now**, **−1 h**, **−12 h**, **−24 h** for historical comparison.
  - Scroll to zoom (cursor-anchored), click-drag to pan, pinch-to-zoom on touch. Double-click resets the view. Auto-refreshes every 10 minutes.
  - Panel height is set when adding the panel via the **Add Panel** picker.
- **Phone View**: Dedicated portrait-optimized layout for operating from a phone or tablet.
- **Split VFO Support**: Full control over split operations with visual feedback.
- **Works With All Hamlib-Compatible Software**: Configure your logging app or other Hamlib enabled application to use "Hamlib NET rigctl" at `127.0.0.1:4532`.
  - WSJT-X, WSJT-X Improved, FLDigi, VarAC, JS8Call, and more.
  - This means not having to split serial ports to use multiple apps.
- **Remote Access**: Access your shack from anywhere over your own VPN (or via not-included reverse proxy) by pointing a browser to your rig computer's IP on port 3000. (e.g. https://192.168.1.2:3000)
  - The server runs over **HTTPS** using an auto-generated self-signed certificate.
  - On first launch, your browser will show a certificate warning. Navigate to Advanced.... then proceed to the site anyway.
  - Audio capabilities require HTTPS. The built-in HTTPS server satisfies this requirement without needing a reverse proxy for LAN use.
  - IMPORTANT: For access outside your LAN (internet/VPN), a reverse proxy with a trusted certificate is still recommended.  Setting up a reverse proxy is beyond the scope of this project, but NGINX Proxy Manager or Cloudflare are places to start.

## TODO

- **macOS Support**: Currently untested.
- **Broader Rig Testing**: Currently tested on FT-710,FT-891,IC-7300. Other similar modern Yaesu radios should work well. Other Hamlib-supported rigs should work.  Let me know with a bug report.

## What this app is/isn't
- This app is for modern or the most popular rigs on the market which do not have built-in networking capabilities available, or rigs which require a subscription service to use them.  Examples include FT-710, FT-DX10, IC-7300, IC-7300 Mk II, FTX-1/F, FT-991A, FT-891, Kenwood 590/890/990, and other popular non-networked rigs which are supported by Hamlib.  Rig control will not be reinvented in this app.  I'll leave that to the experts.
- Audio capabilities are dependent on the radio having a modern and widely used digital sound interface, whether that's with a built-in sound card, Digirig, Allscan URI, Master Communications DRI, or the like.
- Spectrum scope capabilities require the radio to output that data in some supported way.  Either with USB or CI-V.
- Video capabilities are dependent on the radio having a video output of some kind, which can be fed back into the shack computer with an adapter.  (https://a.co/d/08s41ath + https://a.co/d/00hEobog for example for a modern Yaesu rig).
- **What it's not!** This app is not for making every rig on earth work 100% correctly with the software.  This software may never work perfectly with your TenTec 506 Rebel, for example.  There will not be 1000 different rig control options and 17 different ways to interface with every CW keyer under the sun.  Rotators, amplifiers, satellite ops, etc will not likely be supported unless there is broad community impact.  This app is about bringing a simple way to remotely operate your rig to the masses.

## Prerequisites

### Common
- **Operating Systems**:
  - **Windows 10 or higher** (tested on Windows 11 23H2) — The Electron installer includes a bundled `rigctld` compiled from Hamlib 4.7.x with multicast support. No separate Hamlib installation required.
    - For audio, use MME or DirectSound devices from the backend audio device selector. WASAPI requires the Windows audio device to be configured at 48 kHz in Sound settings (for example, FT-710 only works at 44,100).
  - **Linux kernel 6.0 or higher** (tested on Fedora 43) — The Electron AppImage includes a bundled `rigctld`. For `npm run dev` (web server mode), Hamlib 4.7.0+ must be installed separately — see the warning below.
    - Most Linux distros, including extremely modern ones seem to still be bundling Hamlib 4.6.5.  This will NOT work.  Install from the Hamlib GitHub page.
  - **macOS**
    - Completely untested.  No testing hardware.

### Compile from Source
- **Node.js**: Version 24 or higher.
- **Hamlib**: 4.7.0 or higher.
  - **Electron Apps**: A bundled `rigctld` is auto-provisioned at build time by `scripts/build-rigctld.mjs` (runs as part of `npm run electron:build`). It will skip the build if a binary is already present in `bin/[linux|windows|mac]/`. The app falls back to the system `rigctld` if no bundled binary is found.

### Installing Hamlib (if required, 4.7.0 or higher)
- **Linux**: `sudo apt install libhamlib-utils`, `sudo dnf install hamlib`
  - **WARNING**: Most Linux distros, including extremely modern ones seem to still be bundling Hamlib 4.6.5 (as of May 2026).  This will NOT work.  Install from the Hamlib GitHub page. [Hamlib website](https://hamlib.github.io/)
- **macOS**: `brew install hamlib`
- **Windows**: Download and install from the [Hamlib website](https://hamlib.github.io/).

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the web server in development mode:
   ```bash
   npm run dev
   ```
3. Open [https://localhost:3000](https://localhost:3000) in your browser.

## Desktop App (Electron)

RigControl Web can be run as a native desktop application. The backend Express server runs silently in the background and the frontend is displayed in a native window. Audio hardware is released cleanly when the app exits.

### Run in Development
```bash
npm run electron:dev
```

### Build for Production

#### Windows (NSIS Installer)
```bash
npm run electron:build -- --win
```

#### Linux (AppImage)
```bash
npm run electron:build -- --linux
```

#### macOS (DMG Installer, arm64)
```bash
npm run electron:build -- --mac --arm64
```

> The resulting `.dmg` is **unsigned**. On first launch, right-click the app in Finder → **Open** → **Open** to bypass Gatekeeper.

Built installers are placed in the `build/` directory.

### Linux GNOME Desktop Integration (AppImage)

The AppImage is portable and does not register with your desktop environment by default. To add RigControl Web to your GNOME application menu with the correct icon and taskbar association, run the AppImage once with `--install`:

```bash
./RigControl-Web-<version>.AppImage --install
```

This copies the app icon to `~/.local/share/icons/` and writes a `.desktop` entry to `~/.local/share/applications/`. The AppImage itself is not moved — keep it wherever you like.

To remove the desktop integration:

```bash
./RigControl-Web-<version>.AppImage --uninstall
```

### Launching the Installed App
Once installed, launch "RigControl Web" from your applications menu or desktop shortcut. The application will:
1. Start the background Express server.
2. Open the UI — configure your rig settings and start `rigctld` from the Settings panel.

### Diagnostic Logging

By default the app runs quietly — only errors and key status messages are printed. To enable diagnostic output for specific subsystems, launch with one or more `--debug-*` flags:

| Flag | What it enables |
|------|----------------|
| `--debug-rig` | Hamlib command traffic, capability detection, poll cycle details |
| `--debug-audio` | Audio pipeline — encoding, decoding, device selection, jitter buffer |
| `--debug-video` | Video chunk relay, encoder/decoder events |
| `--debug-cw` | CW keyer state machine, DTR/RTS line changes |
| `--debug-spectrum` | FT4222 spectrum reader lifecycle, frame parse errors, restart events |
| `--debug-infra` | Server startup, shutdown steps, TLS certificate, settings I/O |
| `--debug-all` | All subsystems at once |

Flags can be combined (e.g. `--debug-rig --debug-audio`).

**Windows:**
```
"RigControl Web.exe" --debug-rig
```
**Linux:**
```
rigcontrol-web --debug-rig
```
**Development:**
```
npm run dev -- --debug-rig
```

Debug flags are forwarded to connected browser clients, which print matching diagnostic output to their DevTools console for the same subsystems.

## Configuration

### Authentication

RigControl Web requires a login before any controls are accessible.

**First launch:** The server creates a default `ADMIN` account with password `admin`. You will be forced to change this password before the dashboard loads. Change it immediately — the default credential is public.

**Roles:** Users are either `admin` (full access including the Admin panel) or `regular` (full rig control access, no Admin panel).

**Login:** Enter your callsign and password on the login screen. On success, a JWT token valid for 7 days is stored in `localStorage` and reused on subsequent page loads. Callsigns are normalized to upper-case.

**Logout:** Click the **Logout** button in the app header.

**Change password:** Any user can change their own password from the password-change dialog, accessible via the link next to the Logout button. Minimum 8 characters, maximum 72.

**Admin panel:** Admins access the **Admin** tab in General Settings. From there you can:
- Create, delete, and modify user accounts
- Reset passwords (forces re-entry on next login)
- Promote/demote users between `admin` and `regular`
- View and force-terminate active sessions
- Browse a timestamped audit log of all auth events
- View and clear callsign-level rate-limit lockouts
- Clear a user's stored layout preferences
- Perform a factory reset (deletes all accounts and rotates the JWT secret)

**Rate limiting:** 5 failed login attempts per IP (15-minute window) and 10 per callsign (proxy-safe, admin-clearable). Password-change attempts are also rate-limited at 5 per callsign.

**Resetting accounts on reinstall (Windows):** User accounts and settings are stored outside the program folder (in `%APPDATA%\RigControl Web`), so they survive a normal uninstall/reinstall — an old login will still be in effect after reinstalling. To wipe them, the Windows uninstaller now asks **"Also delete RigControl Web user data (saved settings and login accounts)?"** — choose **Yes** to remove all accounts and settings. (The prompt defaults to No, so data is kept unless you opt in.) After deletion, the next launch reseeds the default `ADMIN` / `admin` account. You can also delete `%APPDATA%\RigControl Web` manually while the app is closed.

### General Settings (gear icon)

Open the **General Settings** panel (gear icon) to configure. Settings are organized into two tabs:

#### RIGCTLD Tab

**Client Side Settings (Connection to rigctld)**
- **Host Address**: IP address of the machine running `rigctld` (default `127.0.0.1`).
- **Port**: TCP port `rigctld` is listening on (default `4532`).
- **Poll Rate**: How often the rig state is polled (250 ms – 5000 ms).

**Server Side / Backend Settings**
- **Rig Model**: Hamlib model ID for your radio (searchable dropdown).
- **Serial Port**: Device path for the rig's control port (e.g. `/dev/ttyUSB0` or `COM3`).
- **Server Port**: Port that `rigctld` will listen on.
- **Serial Speed**: Baud rate for the rig's control port.
- **Listen Address**: IP address `rigctld` will bind to (default `127.0.0.1`).

The tab also includes **Start / Stop / Test** controls for the `rigctld` process and a live process log view.

#### CW Tab

- **Enable CW Keyer**: Activates keyboard keying and sidetone. The keyer becomes active as soon as the rig is connected — no audio session required.
- **Keying Method**: How the key output is delivered — **DTR** (default), **RTS**, or **CAT PTT** (uses the rig's PTT line via Hamlib — last resort; most radios process CAT commands too slowly for clean CW timing).
- **Keyer Serial Port**: The port the keyer interface is connected to (may differ from the rig's control port).
- **Key Polarity**: Whether line high or line low activates the key. Most interfaces use Active High.
- **Keyer Mode**: **Iambic A**, **Iambic B**, or **Straight Key**.
- **Speed (WPM)**: Words per minute — adjustable 5–30 WPM.
- **Sidetone**: Enable/disable local audio feedback, set tone frequency (Hz), and volume. The sidetone plays instantly in the browser — it does not travel through the radio.
- **Key Bindings**: Rebind the dit, dah, and straight key keyboard keys. Click the binding and press any key to rebind.

### Video Settings (gear icon in the Video Feed panel)

Open the **Video Settings** modal from the gear icon in the **Video Feed** panel.

- **Video Device**: Capture device to stream (populated by the host Electron app).
- **Resolution**: Width × height in pixels.
- **Framerate**: 5, 10, 15, 24, or 30 fps.
- Start / Stop video stream controls.

### Audio Settings (gear icon in the Audio Feed panel)

Open the **Audio Settings** modal from the gear icon in the **Audio Feed** panel. The mute buttons and **Join Audio** prompt also live in the **Audio Feed** panel header.

*Local Client Audio (Your System)*
- **Local Input (Microphone)**: Browser-side mic device used to transmit your voice.
- **Local Output (Speakers/Headphones)**: Browser-side output device for received audio.
- **Local Speaker Volume**: A slider (0–200%) controls the volume of received audio in your browser. 100% is unity gain. Above 100% amplifies the signal — useful when your system volume is already at maximum.

*Backend Audio Engine*
- **Backend Input**: Server-side audio input device (the radio's audio output — e.g. USB Audio, Digirig).
- **Backend Output**: Server-side audio output device (the radio's audio input).
- Enable/disable inbound and outbound audio channels independently.
- Start / Stop backend audio engine controls.

### Spot Settings (gear icon in each Spots panel)

Each POTA, SOTA, WWFF, and combined Spots panel has its own settings gear icon. Options are identical for each:
- **Poll Frequency**: How often to fetch new spots (1–5 minutes).
- **Max Spot Age**: Discard spots older than this threshold (1–15 minutes).
- **Mode Filter**: Limit spots to SSB, CW, FT8, FT4, or All.
- **Band Filter**: Multi-select checkbox grid. All bands shown when none are selected.

### Solar Panel

Add the **Solar** panel to your layout via the **Add Panel** button. No configuration is required — data is fetched automatically by the server.

The panel has three tabs:

- **HF**: Quick-glance SFI / SN / A-index / K-index at the top, followed by a Day/Night condition table for 80m–40m, 30m–20m, 17m–15m, and 12m–10m. Conditions are color-coded Good (green) / Fair (amber) / Poor (red).
- **VHF**: Propagation condition table (Aurora, Sporadic-E, Troposcatter, Meteor Scatter) broken out by region (N. Hemisphere, N. America, Europe, Europe 6m/4m). Shows Band Open or Band Closed status.
- **SOLAR/GEO**: Full solar indices — SFI, Sunspot Number, eSFI, eSSN (estimated values from prop.kc2g.com when available) — plus geomagnetic data: A-index, K-index, geomagnetic field description, X-ray flux class, and signal noise level.

A manual refresh button and data timestamp are shown at the bottom of the panel. The server caches solar data for 1 hour; multiple connected clients share the same cached fetch.

### MUF Map Panel

Add the **MUF Map** panel via the **Add Panel** picker. Panel height is set at add-time via the picker's height slider and can be changed by removing and re-adding the panel.

Controls in the panel header:

- **Metric**: **MUFD** — Maximum Usable Frequency for a 3000 km path; **foF2** — F2 layer critical frequency.
- **Time slot**: **Now** (current), **−1h**, **−12h**, **−24h** for historical comparison.
- **Refresh** button (top-right): forces an immediate map reload. The map also auto-refreshes every 10 minutes.

Navigation:

- **Scroll** to zoom in/out, anchored to the cursor position.
- **Click-drag** to pan when zoomed in.
- **Pinch** to zoom on touch screens.
- **Double-click** (or tap the zoom percentage badge) to reset to 1×.

Map data is sourced from [prop.kc2g.com](https://prop.kc2g.com/) (KC2G/WWROF/GIRO) and requires an internet connection.

## License

Apache-2.0. See [LICENSE.md](LICENSE.md) for the full license text and third-party dependency licenses.
