# Headless Deployment (Pi / Mini PC)

RigControl Web's backend (`server.ts`) runs standalone — no Electron, no
GUI, no display server required. This makes it a good fit for a dedicated
radio-controller box (Raspberry Pi, N100/N150 mini PC, an old laptop, a
NAS) running headless in the shack, controlled remotely from a browser on
another machine.

This guide covers three ways to run it: **Docker Compose** (recommended),
plain `docker run`, and **systemd** (no container runtime). Commands below
use `docker`; `podman` is a drop-in substitute for `docker build`/`docker
run`/`docker exec` (same flags, verified working end to end including real
device passthrough, on a real Fedora host) — see the rootless-podman caveat
under Troubleshooting near the end of this doc if you're not running a
root-daemon setup. `podman compose` additionally requires installing
`podman-compose` separately (unlike Docker, where `docker compose` ships
built in) — if you don't have it, use Option 2 (plain run) with `podman`
instead of Option 1.

**Feature gap:** the video-source feature requires the Electron desktop
app as the camera capture origin — a headless deployment has no video
source. Everything else (rig control, audio, CW keyer, CW decode,
spectrum, spots, solar data, admin panel) works exactly as in the desktop
app, viewed from any browser pointed at the controller's IP.

**Platform support:** this stage is **x64 only**. ARM64 (Raspberry Pi
3/4/5, running a 64-bit OS) is a planned follow-up — track it in issue #23.
N100/N150 mini PCs and any other x86_64 Linux box are supported today.

---

## Why host networking?

The Hamlib UDP spectrum source (`spectrumSettings.source === "hamlib"`)
receives a **multicast** UDP stream from `rigctld`. Docker's default
bridge network mode puts the container behind a NAT'd virtual interface
that LAN multicast traffic generally can't reach — so in bridge mode, the
Hamlib UDP spectrum panel would just go dead with no obvious error, while
everything else kept working fine. Host networking (`network_mode: host`)
avoids this by giving the container the host's real network stack, so
multicast reception works exactly as it would running `node server.ts`
directly. The cost — losing Docker's port isolation — doesn't matter on a
box dedicated to this one job. If you know you'll only ever use the FT4222
or Audio I/Q spectrum sources (neither uses multicast), bridge mode with
explicit `-p 3000:3000` port mapping works fine too.

---

## Device access

**Group GIDs matter — don't use group names, use numbers.** The non-root
container user reaches `/dev/ttyUSB0`/`/dev/snd` via `--group-add
dialout --group-add audio`, but Docker/Podman resolve those *names*
against `/etc/group` **inside the image**, not the host. The image (built
from `ubuntu:24.04`) bakes in `dialout=20`, `audio=29` — real hosts
commonly use different values (confirmed on a real Ubuntu 24.04 test
host: `dialout=18`, `audio=63`). Using the names silently grants the
*wrong* GIDs and device access fails with no obvious error. Always look
up your actual host GIDs and pass them as numbers:

```bash
getent group dialout audio | awk -F: '{print $1"="$3}'
```

`docker-compose.yml` reads these from `DIALOUT_GID`/`AUDIO_GID` environment
variables (export them or put them in a `.env` file next to the compose
file) rather than hardcoding names.

### Serial (CAT control)

Find your radio's stable device path (this survives reboots and USB
replugging, unlike `/dev/ttyUSB0`, which can shift):

```bash
ls -l /dev/serial/by-id/
```

Use that path in place of `/dev/ttyUSB0` below.

### Audio (radio's USB sound card)

Pass through the whole ALSA subsystem (`/dev/snd`) rather than a specific
`hw:X,Y` device — the card index isn't stable either. This is actually
*more* reliable than a typical desktop install: the documented "PipeWire
doesn't reconnect after a radio power cycle" issue only exists because a
desktop-session PipeWire daemon is running and re-targets its default
device when the USB audio interface disappears and reappears. A headless
controller has no desktop session and no PipeWire running at all, so raw
ALSA passthrough sidesteps that whole problem.

### FT4222 (FT-710 spectrum scope)

This one is genuinely harder to containerize than serial or audio:

- There's no single stable device path — USB bus/device numbers renumber
  on replug.
- The host's udev rules from
  [`docs/ft4222-spectrum-setup.md`](ft4222-spectrum-setup.md) (the
  `uaccess`/`dialout` group grant) still govern access even through a bind
  mount — Docker doesn't bypass host device permissions.

If you want to try it anyway, mount the whole USB bus and grant the USB
device class via cgroup rule (uncomment the relevant block in
`docker-compose.yml`):

```yaml
devices:
  - /dev/bus/usb:/dev/bus/usb
device_cgroup_rules:
  - "c 189:* rmw"
```

**Recommendation:** if FT4222 spectrum is important to you, use the
systemd deployment below instead — the existing FT4222 setup doc applies
unmodified on bare metal, with none of the above caveats.

---

## Option 1: Docker Compose (recommended)

1. Install Docker (`docker` + the `docker compose` plugin — most current
   distro packages bundle both).
2. Download `docker-compose.yml` from the repo (or clone it):
   ```bash
   curl -O https://raw.githubusercontent.com/jbdubbs/Rig-Control-Web/main/docker-compose.yml
   ```
3. Edit the serial device line to match your radio (see "Serial" above).
4. Look up and export this host's real `dialout`/`audio` GIDs (see
   "Device access" above — don't skip this, the defaults will not match):
   ```bash
   export DIALOUT_GID=$(getent group dialout | cut -d: -f3)
   export AUDIO_GID=$(getent group audio | cut -d: -f3)
   ```
5. Start it:
   ```bash
   docker compose up -d
   ```
6. Browse to `https://<controller-ip>:3000` — the self-signed certificate
   will prompt a browser warning the first time; this is normal and
   expected (the certificate is self-generated for encryption, not issued
   by a trusted authority). Log in as `ADMIN` / `admin`; you'll be forced
   to set a new password on first login.
7. To update: `docker compose pull && docker compose up -d`.

Settings, user accounts, and TLS certs persist in the `rcw-data` named
volume across restarts/upgrades.

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

For a box where you'd rather not run Docker at all:

```bash
# One-time setup
sudo useradd --system --home /opt/rigcontrol-web --shell /usr/sbin/nologin \
  --groups dialout,audio rigcontrol-web
sudo git clone https://github.com/jbdubbs/Rig-Control-Web.git /opt/rigcontrol-web
sudo chown -R rigcontrol-web:rigcontrol-web /opt/rigcontrol-web

# Build as the unprivileged service user, not root — npm install/build
# scripts (node-gyp rebuilds for naudiodon/libopus-node, etc.) run
# arbitrary code and shouldn't do so with root privileges.
sudo -u rigcontrol-web bash -c 'cd /opt/rigcontrol-web && npm ci && npm run build'

sudo mkdir -p /var/lib/rigcontrol-web
sudo chown rigcontrol-web:rigcontrol-web /var/lib/rigcontrol-web

# Install and start the service
sudo cp docs/rigcontrol-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rigcontrol-web
```

Requires Node 24+ (e.g. via NodeSource:
`curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && sudo apt-get install -y nodejs`
on Debian/Ubuntu, or `sudo dnf module install -y nodejs:24` on Fedora/RHEL)
and the same system packages as building from source on Linux
(`libasound2-dev libopus-dev build-essential`, plus `gcc` to compile
`cw-key-helper`/`ft4222-scope-reader` if you need them —
`bin/linux/rigctld` and the other helpers are already committed in the
repo for x64, so this is usually just `npm ci && npm run build`).

Check status/logs with `systemctl status rigcontrol-web` /
`journalctl -u rigcontrol-web -f`.

---

## Troubleshooting: rootless Docker/Podman and device access

If you're running **rootless** Docker or Podman (increasingly the default
on security-conscious distros — not the standard `docker.io`/`docker-ce`
root-daemon install), device passthrough for serial/audio can fail even
with the correct numeric GIDs from the "Device access" section above.
This is a Linux user-namespace limitation, not specific to this image:
rootless containers can only represent host GIDs that fall inside the
container engine's delegated `/etc/subgid` range, and low "system" GIDs
like `dialout`/`audio` normally don't. Symptoms: `Permission denied`
reading/writing the device even though `id` inside the container shows
the right supplementary group numbers.

Things to try, roughly in order of how likely they are to help:

1. Run as `root` (rootless-mode "root" is still confined to your own user's
   privileges on the host, so this is not the same risk as `root` under a
   root-daemon install) — sometimes sufficient, but not guaranteed to fix
   arbitrary GID access.
2. Podman's rootless-specific escape hatch:
   `--userns=keep-id --user "$(id -u):$(id -g)" --group-add keep-groups`
   — intended to preserve your invoking host user's real supplementary
   groups inside the container. Whether this actually grants access
   depends on your kernel/crun/podman version; it did not resolve the
   issue in one tested rootless environment, so treat it as worth trying,
   not a guaranteed fix.
3. **Most reliable, and confirmed working:** use a standard root-daemon
   Docker install (`docker.io` / `docker-ce`, the default on most distros)
   rather than rootless mode. Without user-namespace remapping, numeric
   `--group-add` works exactly as documented above with no further
   workarounds needed — verified end to end (real serial + audio device
   read/write access) on a real Fedora host during this feature's
   development. This is the setup a dedicated Pi/mini-PC controller would
   typically run.

## Firewall

Open TCP 3000 (HTTPS) inbound from your LAN. If you use the Hamlib UDP
spectrum source, also confirm UDP traffic on your multicast port (default
4531) isn't blocked between `rigctld`'s host and this box, if they're
different machines.
