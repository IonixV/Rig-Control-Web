# Headless (no Electron/GUI) deployment image for RigControl Web.
# See docs/headless-deployment.md for `docker run`/compose usage, and the
# glibc-2.39 floor rationale (docs/linux-packages.md) for why both stages
# below are pinned to ubuntu:24.04 rather than a Debian-based Node image.

FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg \
      build-essential python3 \
      libasound2-dev libopus-dev \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

########################

FROM ubuntu:24.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    RCW_DATA_DIR=/data

# Runtime shared-library subset of the deb/rpm "depends" lists in package.json
# (build.deb.depends / build.rpm.depends), dropping the Electron/Chromium-only
# GUI libs (libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils,
# libatspi2.0-0, libsecret-1-0) that a headless deployment never loads.
# libpulse0 is required even though naudiodon's actual I/O path is
# ALSA/PipeWire, because its prebuilt libportaudio.so.2 dynamically links
# libpulse.so.0 and fails to import without it (see project notes on the
# same requirement in CI). libusb-1.0-0 is for ft4222-scope-reader/libft4222.
# libasound2/libreadline8 are ambiguous virtual packages on Ubuntu 24.04
# (Noble's 64-bit time_t transition) with no installable candidate under
# their old names — apt-get needs the real libasound2t64/libreadline8t64
# package names directly (this only affects a direct `apt-get install`;
# electron-builder's .deb Depends: libasound2 field resolves fine via
# apt's Provides mechanism, which is why test-linux-packages.sh never
# caught this).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg \
      libasound2t64 libpulse0 libusb-1.0-0 libreadline8t64 libportaudio2 libuuid1 \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin rcw \
    && mkdir -p /data && chown rcw:rcw /data

WORKDIR /app

COPY --from=builder --chown=rcw:rcw /app/dist ./dist
COPY --from=builder --chown=rcw:rcw /app/server ./server
COPY --from=builder --chown=rcw:rcw /app/node_modules ./node_modules
COPY --from=builder --chown=rcw:rcw /app/server.ts ./server.ts
COPY --from=builder --chown=rcw:rcw /app/radios.json ./radios.json
COPY --from=builder --chown=rcw:rcw /app/package.json ./package.json
COPY --chown=rcw:rcw bin/linux ./bin/linux

VOLUME ["/data"]
USER rcw
EXPOSE 3000

ENTRYPOINT ["node", "server.ts"]
