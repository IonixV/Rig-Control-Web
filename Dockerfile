# Headless (no Electron/GUI) deployment image for RigControl Web.
# See https://github.com/jbdubbs/Rig-Control-Web/wiki/Headless-Deployment
# ("Image runtime dependencies") for usage and the rationale behind the
# package lists below.

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

# Trimmed subset of package.json's deb/rpm depends lists — see the Headless Deployment wiki page
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
