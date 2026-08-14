# Headless Deployment (Pi / Mini PC)

RigControl Web's backend runs standalone — no Electron, no GUI, no display
server required. This makes it a good fit for a dedicated radio-controller
box (Raspberry Pi, N100/N150 mini PC, an old laptop, a NAS) running headless
in the shack, controlled remotely from a browser on another machine.

This guide covers three ways to run it: **Docker Compose** (recommended),
plain `docker run`, and **systemd** (no container runtime). Commands below
use `docker`; `podman` is a drop-in substitute for `docker build`/`docker
run`/`docker exec` (same flags, verified working end to end including real
device passthrough, on a real Fedora host) — see the rootless-podman caveat
under Troubleshooting near the end of this page if you're not running a
root-daemon setup. `podman compose` additionally requires installing
`podman-compose` separately (unlike Docker, where `docker compose` ships
built in) — if you don't have it, use Option 2 (plain run) with `podman`
instead of Option 1.

**Feature gap:** the video feed requires the Electron desktop app as the
camera capture origin — a headless deployment has no video source.
Everything else (rig control, audio, CW keyer, CW decode, spectrum, spots,
solar data, admin panel) works exactly as in the desktop app, viewed from
any browser pointed at the controller's IP.

**Platform support:** this stage is **x64 only**. ARM64 (Raspberry Pi
3/4/5, running a 64-bit OS) is a planned follow-up.

---

## Why host networking?

The [Hamlib UDP Spectrum Scope](Spectrum-Scope-Hamlib-UDP) receives a
**multicast** UDP stream from `rigctld`. Docker's default bridge network
mode puts the container behind a NAT'd virtual interface that LAN
multicast traffic generally can't reach — so in bridge mode, the Hamlib
UDP spectrum panel would just go dead with no obvious error, while
everything else kept working fine. Host networking avoids this by giving
the container the host's real network stack. The cost — losing Docker's
port isolation — doesn't matter on a box dedicated to this one job. If
you'll only ever use the [FT-710](Spectrum-Scope-FT-710) or
[Audio I/Q](Spectrum-Scope-Audio-IQ) spectrum sources (neither uses
multicast), bridge mode with explicit port mapping works fine too.

---

## Device access

**Group GIDs matter — don't use group names, use numbers.** The non-root
container user reaches `/dev/ttyUSB0`/`/dev/snd` via `--group-add
dialout --group-add audio`, but Docker/Podman resolve those *names*
against `/etc/group` **inside the image**, not the host. The image bakes
in `dialout=20`, `audio=29` — real hosts commonly use different values
(confirmed on a real Ubuntu 24.04 test host: `dialout=18`, `audio=63`).
Using the names silently grants the *wrong* GIDs and device access fails
with no obvious error. Always look up your actual host GIDs and pass them
as numbers:

```bash
getent group dialout audio | awk -F: '{print $1"="$3}'
```

### Serial (CAT control)

Find your radio's stable device path (survives reboots/replugging, unlike
`/dev/ttyUSB0`, which can shift):

```bash
ls -l /dev/serial/by-id/
```

### Audio (radio's USB sound card)

Pass through the whole ALSA subsystem (`/dev/snd`) rather than a specific
card index, which isn't stable either. This is actually more reliable than
a typical desktop install — the "PipeWire doesn't reconnect after a radio
power cycle" issue described in [Audio and Video](Audio-and-Video) only
happens because a desktop-session PipeWire daemon is running. A headless
controller has no desktop session and no PipeWire at all, so raw ALSA
passthrough sidesteps that entire problem.

### FT4222 (FT-710 spectrum scope)

Harder to containerize than serial or audio — USB bus/device numbers
renumber on replug, and the host udev rules from
[FT-710 Spectrum Scope Setup](Spectrum-Scope-FT-710) still govern access
even through a bind mount. If FT4222 spectrum matters to you, use the
systemd option below instead, where that setup guide applies unmodified.

---

## Option 1: Docker Compose (recommended)

1. Install Docker (`docker` + the `docker compose` plugin).
2. Download [`docker-compose.yml`](https://github.com/jbdubbs/Rig-Control-Web/blob/main/docker-compose.yml)
   from the repo.
3. Edit the serial device line to match your radio.
4. Export this host's real GIDs (don't skip — see "Device access" above):
   ```bash
   export DIALOUT_GID=$(getent group dialout | cut -d: -f3)
   export AUDIO_GID=$(getent group audio | cut -d: -f3)
   ```
5. `docker compose up -d`
6. Browse to `https://<controller-ip>:3000`, accept the self-signed
   certificate warning, and log in as `ADMIN` / `admin` (forced password
   change on first login — see [Authentication](Authentication)).
7. To update: `docker compose pull && docker compose up -d`.

## Option 2: Plain `docker run`

```bash
docker run -d \
  --name rigcontrol-web \
  --restart unless-stopped \
  --network host \
  --group-add "$(getent group dialout | cut -d: -f3)" \
  --group-add "$(getent group audio | cut -d: -f3)" \
  --device /dev/serial/by-id/usb-REPLACE_ME:/dev/ttyUSB0 \
  --device /dev/snd:/dev/snd \
  -e RCW_DATA_DIR=/data \
  -v rcw-data:/data \
  jbdubbs/rigcontrol-web:latest
```

## Option 3: systemd (no container runtime)

```bash
sudo useradd --system --home /opt/rigcontrol-web --shell /usr/sbin/nologin \
  --groups dialout,audio rigcontrol-web
sudo git clone https://github.com/jbdubbs/Rig-Control-Web.git /opt/rigcontrol-web
sudo chown -R rigcontrol-web:rigcontrol-web /opt/rigcontrol-web

# Build as the unprivileged service user, not root — install/build
# scripts (node-gyp rebuilds, etc.) run arbitrary code.
sudo -u rigcontrol-web bash -c 'cd /opt/rigcontrol-web && npm ci && npm run build'

sudo mkdir -p /var/lib/rigcontrol-web
sudo chown rigcontrol-web:rigcontrol-web /var/lib/rigcontrol-web

sudo cp docs/rigcontrol-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rigcontrol-web
```

Requires Node 24+ (e.g. via NodeSource:
`curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && sudo apt-get install -y nodejs`
on Debian/Ubuntu, or `sudo dnf module install -y nodejs:24` on
Fedora/RHEL); `bin/linux/rigctld` and the other helper binaries are
already committed in the repo for x64, so this is usually just
`npm ci && npm run build`. Check status/logs with
`systemctl status rigcontrol-web` / `journalctl -u rigcontrol-web -f`.

---

## Troubleshooting: rootless Docker/Podman and device access

If you're running **rootless** Docker or Podman, device passthrough for
serial/audio can fail even with the correct numeric GIDs above — a Linux
user-namespace limitation, not specific to this image: rootless containers
can only represent host GIDs inside the engine's delegated `/etc/subgid`
range, and low system GIDs like `dialout`/`audio` normally aren't in it.
Symptoms: `Permission denied` on the device even though `id` inside the
container shows the right group numbers.

1. Try `--user root` (still confined to your own host user's privileges
   under rootless — not the same risk as root under a root-daemon
   install).
2. Podman's rootless escape hatch: `--userns=keep-id --user
   "$(id -u):$(id -g)" --group-add keep-groups`. Not guaranteed — results
   vary by kernel/crun/podman version.
3. **Most reliable, and confirmed working:** a standard root-daemon Docker
   install (`docker.io`/`docker-ce`, the default on most distros) rather
   than rootless mode — numeric `--group-add` works exactly as documented
   with no further workarounds, verified end to end (real serial + audio
   device read/write access) on a real Fedora host. This is what a
   dedicated Pi/mini-PC controller would typically run.

## Firewall

Open TCP 3000 (HTTPS) inbound from your LAN. If you use the Hamlib UDP
spectrum source, also confirm UDP traffic on your multicast port (default
4531) isn't blocked between `rigctld`'s host and this box, if they're
different machines.
