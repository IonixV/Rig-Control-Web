#!/bin/bash
#
# Smoke test for the headless x86-64 bare-metal tarball
# (scripts/build-headless-x64.sh, issue #57). Extracts the tarball into a
# clean, throwaway ubuntu:24.04 container standing in for a fresh target
# host, installs only the runtime packages the tarball's own
# README-headless-x64.md documents (so this test also validates that list
# is correct), and verifies:
#   - the bundled binaries and native Node addons resolve all shared
#     libraries (glibc-2.39-floor check, same technique as
#     scripts/test-linux-packages.sh / scripts/test-headless-docker.sh)
#   - the HTTPS server boots and answers, with no `npm ci`/compile step
#   - a Hamlib Dummy-backend rigctld can be reached
#
# Deliberately does NOT replicate scripts/test-headless-docker.sh's Phase 5
# (/proc/asound masking, issue #55) — that's a container-networking
# regression specific to the Docker/Compose deployment path. A real
# bare-metal systemd install has no such masking layer, and this script's
# own throwaway container is just a stand-in test host, not the deployment
# target this tarball is meant to run on.
#
# Prerequisites: docker or podman (auto-detected; override with
# CONTAINER_ENGINE=docker|podman).
# Usage:
#   bash scripts/test-headless-x64.sh                                  # builds the tarball first via build-headless-x64.sh
#   bash scripts/test-headless-x64.sh path/to/rigcontrol-web-*.tar.gz   # test an already-built tarball

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "${GREEN}${BOLD}  PASS${RESET} $1"; }
fail() { echo -e "${RED}${BOLD}  FAIL${RESET} $1"; FAILURES=$((FAILURES + 1)); }
FAILURES=0

if [ -n "${CONTAINER_ENGINE:-}" ]; then
  ENGINE="$CONTAINER_ENGINE"
elif command -v docker > /dev/null 2>&1; then
  ENGINE=docker
elif command -v podman > /dev/null 2>&1; then
  ENGINE=podman
else
  echo "ERROR: neither docker nor podman found on PATH." >&2
  exit 1
fi
echo "Using container engine: $ENGINE"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TARBALL="${1:-}"
if [ -z "$TARBALL" ]; then
  echo "=== No tarball given — building via scripts/build-headless-x64.sh ==="
  CONTAINER_ENGINE="$ENGINE" bash "$REPO_ROOT/scripts/build-headless-x64.sh"
  VERSION=$(node -p "require('$REPO_ROOT/package.json').version")
  TARBALL="$REPO_ROOT/dist-headless-x64/rigcontrol-web-${VERSION}-linux-x64.tar.gz"
fi
if [ ! -f "$TARBALL" ]; then
  echo "ERROR: tarball not found at $TARBALL" >&2
  exit 1
fi
TARBALL="$(cd "$(dirname "$TARBALL")" && pwd)/$(basename "$TARBALL")"
TARBALL_DIR="$(dirname "$TARBALL")"
TARBALL_NAME="$(basename "$TARBALL")"
echo "=== Testing: $TARBALL ==="

CONTAINER=rigcontrol-web-x64-headless-test
cleanup() { "$ENGINE" rm -f "$CONTAINER" > /dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

# ── Phase 1: Bring up a throwaway ubuntu:24.04 host, install runtime deps,
#    extract the tarball, start the server ──────────────────────────────

echo ""
echo -e "${BOLD}=== SETUP: throwaway ubuntu:24.04 host + tarball extraction ===${RESET}"

MOUNT_SUFFIX=":ro"
[ "$ENGINE" = "podman" ] && MOUNT_SUFFIX=":ro,Z"

"$ENGINE" run -d --name "$CONTAINER" \
  -p 13001:3000 -p 14533:4532 \
  -v "$TARBALL_DIR:/pkg$MOUNT_SUFFIX" \
  ubuntu:24.04 sleep infinity > /dev/null

"$ENGINE" exec "$CONTAINER" bash -c "
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends \
    ca-certificates curl gnupg \
    libasound2t64 libpulse0 libusb-1.0-0 libreadline8t64 libportaudio2 libuuid1
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - > /dev/null
  apt-get install -y -qq --no-install-recommends nodejs
  mkdir -p /opt/rigcontrol-web /data
  tar xzf /pkg/$TARBALL_NAME -C /opt/rigcontrol-web --strip-components=1
"

"$ENGINE" exec -d "$CONTAINER" bash -c '
  cd /opt/rigcontrol-web
  NODE_ENV=production RCW_DATA_DIR=/data node server.ts > /tmp/rcw-server.log 2>&1
'

echo ""
echo -e "${BOLD}=== TEST: Server boots (no npm ci/compile) and serves HTTPS ===${RESET}"

HTTP_CODE="000"
for i in $(seq 1 20); do
  HTTP_CODE=$(curl -sk -o /dev/null -w '%{http_code}' https://127.0.0.1:13001/ 2>/dev/null || echo "000")
  [ "$HTTP_CODE" = "200" ] && break
  sleep 1
done
if [ "$HTTP_CODE" = "200" ]; then
  pass "HTTPS server answers (200)"
else
  fail "HTTPS server did not answer (got $HTTP_CODE) — see log:"
  "$ENGINE" exec "$CONTAINER" cat /tmp/rcw-server.log 2>&1 || true
fi

RUNNING=$("$ENGINE" inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)
[ "$RUNNING" = "true" ] && pass "Container still running (no crash)" || fail "Container exited unexpectedly"

# ── Phase 2: glibc floor — ldd every bundled binary/native addon ───────

echo ""
echo -e "${BOLD}=== TEST: Shared library resolution (glibc floor) ===${RESET}"

LDD_OUTPUT=$("$ENGINE" exec "$CONTAINER" bash -c '
  cd /opt/rigcontrol-web
  for BIN in bin/linux/rigctld bin/linux/cw-key-helper bin/linux/ft4222-scope-reader bin/linux/wsjtx-bridge; do
    if [ -f "$BIN" ]; then
      MISSING=$(ldd "$BIN" 2>&1 | grep "not found" || true)
      echo "LDD_$(basename "$BIN")=${MISSING:-OK}"
    fi
  done
  NA=$(find node_modules/naudiodon -name "*.node" -type f 2>/dev/null | head -1)
  [ -n "$NA" ] && { MISSING=$(ldd "$NA" 2>&1 | grep "not found" || true); echo "LDD_naudiodon=${MISSING:-OK}"; }
  LO=$(find node_modules/libopus-node -name "*.node" -type f 2>/dev/null | head -1)
  [ -n "$LO" ] && { MISSING=$(ldd "$LO" 2>&1 | grep "not found" || true); echo "LDD_libopus=${MISSING:-OK}"; }
' 2>&1)

for CHECK in LDD_rigctld LDD_cw-key-helper LDD_ft4222-scope-reader LDD_wsjtx-bridge LDD_naudiodon LDD_libopus; do
  echo "$LDD_OUTPUT" | grep "${CHECK}=OK" > /dev/null && pass "$CHECK" || fail "$CHECK — missing libs (see output above)"
done

# ── Phase 3: rigctld against Hamlib's Dummy backend ─────────────────────

echo ""
echo -e "${BOLD}=== TEST: Bundled rigctld runs against Hamlib Dummy backend ===${RESET}"

"$ENGINE" exec -d "$CONTAINER" bash -c 'cd /opt/rigcontrol-web && ./bin/linux/rigctld -m 1 -t 4532 > /tmp/rigctld-dummy.log 2>&1'
sleep 1
FREQ=$(python3 -c '
import socket, sys
try:
    s = socket.create_connection(("127.0.0.1", 14533), timeout=3)
    s.settimeout(3)
    s.sendall(b"f\n")
    print(s.recv(1024).decode().strip())
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
' 2>/dev/null)
if [[ "$FREQ" =~ ^[0-9]+$ ]]; then
  pass "Dummy rigctld responded with a frequency ($FREQ)"
else
  fail "Dummy rigctld did not respond as expected (got: '$FREQ')"
fi

# ── Summary ──────────────────────────────────────────────────────────

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All checks passed.${RESET}"
else
  echo -e "${RED}${BOLD}$FAILURES check(s) failed.${RESET}"
  exit 1
fi
