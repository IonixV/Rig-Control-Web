#!/bin/bash
#
# Pre-release smoke test for the headless Docker image (./Dockerfile).
# Builds the image (or accepts a pre-built image reference), runs it
# against a scratch data dir, and verifies:
#   - the bundled binaries and native Node addons resolve all shared
#     libraries inside the image (glibc-2.39-floor check, same technique
#     as scripts/test-linux-packages.sh)
#   - the HTTPS server answers
#   - a Hamlib Dummy-backend rigctld can be reached inside the container
#
# Prerequisites: docker or podman (auto-detected; override with
# CONTAINER_ENGINE=docker|podman if both are installed and you want a
# specific one — e.g. to exercise the root-daemon device-permission model
# real dedicated-controller deployments use, vs. rootless podman's
# user-namespace-constrained one; see the "Troubleshooting: rootless
# Docker/Podman" section in docs/headless-deployment.md).
# Usage:
#   bash scripts/test-headless-docker.sh              # build from the current tree
#   bash scripts/test-headless-docker.sh <image:tag>   # test a pre-built/pulled image

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

CONTAINER=rigcontrol-web-headless-test
IMAGE="${1:-}"

cleanup() { "$ENGINE" rm -f "$CONTAINER" > /dev/null 2>&1 || true; }
trap cleanup EXIT

# ── Phase 1: Obtain the image ───────────────────────────────────────

if [ -z "$IMAGE" ]; then
  IMAGE=rigcontrol-web:headless-test
  echo "=== Building $IMAGE from ./Dockerfile ==="
  # --security-opt label=disable avoids spurious SELinux denials on the
  # build-context bind mount under podman; docker doesn't need (or
  # consistently support) it for `build`, so it's podman-only.
  if [ "$ENGINE" = "podman" ]; then
    podman build --security-opt label=disable -t "$IMAGE" -f Dockerfile .
  else
    docker build -t "$IMAGE" -f Dockerfile .
  fi
else
  echo "=== Using provided image: $IMAGE ==="
fi

# ── Phase 2: Run it ──────────────────────────────────────────────────

echo ""
echo -e "${BOLD}=== TEST: Container starts and serves HTTPS ===${RESET}"

cleanup
# Checks below run from the *host* against published ports, not via `exec`
# into the container — the runtime image deliberately has no curl (it's
# only installed transiently in the Dockerfile to fetch NodeSource, then
# purged), and this is also more representative of what an actual remote
# browser/client sees.
"$ENGINE" run -d --name "$CONTAINER" -p 13000:3000 -p 14532:4532 "$IMAGE" > /dev/null

# Give the server a moment to generate its self-signed cert and bind the port.
HTTP_CODE="000"
for i in $(seq 1 15); do
  HTTP_CODE=$(curl -sk -o /dev/null -w '%{http_code}' https://127.0.0.1:13000/ 2>/dev/null || echo "000")
  [ "$HTTP_CODE" = "200" ] && break
  sleep 1
done
[ "$HTTP_CODE" = "200" ] && pass "HTTPS server answers (200)" || fail "HTTPS server did not answer (got $HTTP_CODE)"

RUNNING=$("$ENGINE" inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)
[ "$RUNNING" = "true" ] && pass "Container still running (no crash-loop)" || fail "Container exited unexpectedly"

# ── Phase 3: glibc floor — ldd every bundled binary/native addon ───────

echo ""
echo -e "${BOLD}=== TEST: Shared library resolution (glibc floor) ===${RESET}"

LDD_OUTPUT=$("$ENGINE" exec "$CONTAINER" bash -c '
  for BIN in bin/linux/rigctld bin/linux/cw-key-helper bin/linux/ft4222-scope-reader; do
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

for CHECK in LDD_rigctld LDD_cw-key-helper LDD_ft4222-scope-reader LDD_naudiodon LDD_libopus; do
  echo "$LDD_OUTPUT" | grep "${CHECK}=OK" > /dev/null && pass "$CHECK" || fail "$CHECK — missing libs (see output above)"
done

# ── Phase 4: rigctld against Hamlib's Dummy backend ─────────────────

echo ""
echo -e "${BOLD}=== TEST: Bundled rigctld runs against Hamlib Dummy backend ===${RESET}"

# rigctld's default listen address is "ANY", so this is reachable via the
# published port from the host without any extra flags.
"$ENGINE" exec -d "$CONTAINER" bash -c './bin/linux/rigctld -m 1 -t 4532 > /tmp/rigctld-dummy.log 2>&1'
sleep 1
FREQ=$(python3 -c '
import socket, sys
try:
    s = socket.create_connection(("127.0.0.1", 14532), timeout=3)
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
