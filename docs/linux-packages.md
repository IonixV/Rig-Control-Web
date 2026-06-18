# Linux DEB & RPM Packages

RigControl Web is available as `.deb` (Debian/Ubuntu) and `.rpm` (Fedora/RHEL) packages in addition to the AppImage.

## Supported Distributions

The packages require **glibc 2.39+**, which sets the minimum supported versions:

| Family | Minimum Version |
|---|---|
| Ubuntu | 24.04 LTS (Noble) |
| Debian | 13 (Trixie) |
| Fedora | 39 |
| RHEL / CentOS Stream / Rocky / Alma | 10 |

Older releases (Ubuntu 22.04, Fedora 38, RHEL 9, etc.) are not supported — use the AppImage instead.

## Installation

### Debian / Ubuntu

```bash
sudo dpkg -i rigcontrol-web_*.deb
sudo apt-get install -f   # resolve any missing dependencies
```

Or in one step with `apt`:

```bash
sudo apt install ./rigcontrol-web_*.deb
```

### Fedora

```bash
sudo dnf install ./rigcontrol-web-*.rpm
```

### Uninstall

```bash
# Debian/Ubuntu
sudo apt remove rigcontrol-web

# Fedora
sudo dnf remove rigcontrol-web
```

## Serial Port Access

To communicate with your radio via USB serial, your user account must be in the appropriate group:

```bash
# Debian / Ubuntu
sudo usermod -aG dialout $USER

# Fedora / RHEL
sudo usermod -aG uucp $USER
```

**You must log out and back in** (or reboot) for the group change to take effect.

## Dependencies

The packages declare all required dependencies, which the package manager installs automatically. Here is what they provide and why:

### App-Specific Dependencies

| Library | DEB Package | RPM Package | Required By |
|---|---|---|---|
| `libasound.so.2` | `libasound2` | `alsa-lib` | PortAudio (naudiodon) — ALSA audio backend |
| `libpulse.so.0` | `libpulse0` | `pulseaudio-libs` | PortAudio (naudiodon) — PulseAudio audio backend |
| `libusb-1.0.so.0` | `libusb-1.0-0` | `libusb1` | `rigctld` — USB radio communication |
| `libreadline.so.8` | `libreadline8` | `readline` | `rigctld` — interactive console support |

### Electron Runtime Dependencies

Standard Electron/Chromium dependencies (GTK3, NSS, X11 libs, etc.) are also declared and resolved automatically by the package manager.

## PulseAudio / PipeWire

The bundled PortAudio library has a hard link to `libpulse.so.0`. This is satisfied by:

- **PulseAudio** — `libpulse0` (DEB) / `pulseaudio-libs` (RPM) — installed by default on most desktop systems
- **PipeWire** — Works if the PulseAudio compatibility layer is installed:
  - Debian/Ubuntu: `pipewire-pulse`
  - Fedora: `pipewire-pulseaudio` (installed by default on Fedora Workstation)

If you run a minimal or server installation without either PulseAudio or PipeWire-pulse, the app will start but **audio will be disabled**.

## FT-710 Spectrum Scope

The FT4222 USB spectrum scope reader requires `libft4222`, which is not available as a distro package. See [ft4222-spectrum-setup.md](ft4222-spectrum-setup.md) for manual installation instructions.

## AppImage vs Native Packages

| | AppImage | DEB / RPM |
|---|---|---|
| Dependencies | Self-contained, bundles everything | Relies on system package manager |
| Desktop integration | Auto-installs on first launch; manual `--install` / `--uninstall` | Automatic via package manager |
| Updates | Download and replace the file | `apt upgrade` / `dnf upgrade` |
| Older distros | Works on any glibc 2.39+ system | Requires compatible package names |
| Sandboxing | Runs from user directory | Installed to `/opt/` with system permissions |

Choose AppImage if you want a single portable file or run an unsupported distro. Choose DEB/RPM for proper system integration and dependency management.
