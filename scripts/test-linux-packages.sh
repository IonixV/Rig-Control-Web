#!/bin/bash
#
# Pre-release smoke test for Linux DEB and RPM packages.
# Builds packages in an Ubuntu 24.04 container, then installs them in
# Ubuntu 24.04 and Fedora 39 containers to verify dependency resolution,
# desktop integration, and shared library availability.
#
# Prerequisites: podman
# Usage: bash scripts/test-linux-packages.sh [path/to/*.deb path/to/*.rpm]
#
# If no arguments are given, packages are built from the current tree
# inside a container (takes ~3 minutes). If paths are given, those
# pre-built packages are tested directly.

set -euo pipefail

PACKAGES_DIR=$(mktemp -d)
trap 'rm -rf "$PACKAGES_DIR"' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "${GREEN}${BOLD}  PASS${RESET} $1"; }
fail() { echo -e "${RED}${BOLD}  FAIL${RESET} $1"; FAILURES=$((FAILURES + 1)); }
FAILURES=0

# ── Phase 1: Obtain packages ────────────────────────────────────────

if [ $# -ge 2 ]; then
  echo "Using provided packages:"
  cp "$1" "$2" "$PACKAGES_DIR/"
  ls -lh "$PACKAGES_DIR/"
else
  echo "=== Building packages in Ubuntu 24.04 container ==="
  podman run --rm \
    --security-opt label=disable \
    -v "$(pwd):/project:ro" \
    -v "$PACKAGES_DIR:/output" \
    ubuntu:24.04 \
    bash -c '
      set -e
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq curl git libasound2-dev libopus-dev rpm gcc g++ make python3 xz-utils > /dev/null 2>&1
      curl -fsSL https://deb.nodesource.com/setup_24.x | bash - > /dev/null 2>&1
      apt-get install -y -qq nodejs > /dev/null 2>&1
      echo "Node: $(node --version)"
      cp -a /project /build-src
      cd /build-src
      npm ci 2>&1 | tail -3
      npm run build 2>&1 | tail -3
      npm run build:electron 2>&1 | tail -3
      gcc -O2 -o bin/linux/cw-key-helper cw-key-helper.c
      gcc -O2 -o bin/linux/ft4222-scope-reader ft4222-scope-reader.c -ldl
      npx electron-builder --linux --publish never 2>&1 | grep -E "^\s*•|building|Error|⨯"
      cp build/*.deb build/*.rpm /output/ 2>/dev/null
      echo "Built:"
      ls -lh /output/
    '
fi

DEB=$(ls "$PACKAGES_DIR"/*.deb 2>/dev/null | head -1)
RPM=$(ls "$PACKAGES_DIR"/*.rpm 2>/dev/null | head -1)

if [ -z "$DEB" ] || [ -z "$RPM" ]; then
  echo "ERROR: Missing .deb or .rpm in $PACKAGES_DIR"
  exit 1
fi

# ── Phase 2: Test DEB on Ubuntu 24.04 ───────────────────────────────

echo ""
echo -e "${BOLD}=== TEST: Ubuntu 24.04 — DEB install ===${RESET}"
DEB_OUTPUT=$(podman run --rm \
  --security-opt label=disable \
  -v "$PACKAGES_DIR:/packages:ro" \
  ubuntu:24.04 \
  bash -c '
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq > /dev/null 2>&1
    apt-get install -y /packages/*.deb > /dev/null 2>&1
    RESULT=$?
    echo "INSTALL_EXIT=$RESULT"

    echo "DESKTOP_FILE=$(test -f /usr/share/applications/rigcontrol-web.desktop && echo OK || echo MISSING)"
    echo "ICON_FILE=$(test -f /usr/share/icons/hicolor/512x512/apps/rigcontrol-web.png && echo OK || echo MISSING)"

    echo "HAS_DEPENDS=$(dpkg -s rigcontrol-web 2>/dev/null | grep -c ^Depends: || echo 0)"

    for BIN in cw-key-helper ft4222-scope-reader; do
      F=$(find /opt -name "$BIN" -type f 2>/dev/null | head -1)
      if [ -n "$F" ]; then
        MISSING=$(ldd "$F" 2>&1 | grep "not found" || true)
        echo "LDD_${BIN}=${MISSING:-OK}"
      fi
    done

    PA=$(find /opt -name "libportaudio.so.2" -type f 2>/dev/null | head -1)
    if [ -n "$PA" ]; then
      MISSING=$(ldd "$PA" 2>&1 | grep "not found" || true)
      echo "LDD_libportaudio=${MISSING:-OK}"
    fi

    NA=$(find /opt -name "naudiodon.node" -type f 2>/dev/null | head -1)
    if [ -n "$NA" ] && [ -n "$PA" ]; then
      MISSING=$(LD_LIBRARY_PATH=$(dirname "$PA") ldd "$NA" 2>&1 | grep "not found" || true)
      echo "LDD_naudiodon=${MISSING:-OK}"
    fi

    LO=$(find /opt -name "libopus-node.glibc.node" -type f 2>/dev/null | head -1)
    if [ -n "$LO" ]; then
      MISSING=$(ldd "$LO" 2>&1 | grep "not found" || true)
      echo "LDD_libopus=${MISSING:-OK}"
    fi

    ELECTRON=$(find /opt -name "rigcontrol-web" -type f -executable 2>/dev/null | head -1)
    if [ -n "$ELECTRON" ]; then
      MISSING=$(ldd "$ELECTRON" 2>&1 | grep "not found" || true)
      echo "LDD_electron=${MISSING:-OK}"
    fi
  ' 2>&1)

echo "$DEB_OUTPUT" | grep "INSTALL_EXIT=0" > /dev/null && pass "DEB install succeeded" || fail "DEB install failed"
echo "$DEB_OUTPUT" | grep "DESKTOP_FILE=OK" > /dev/null && pass "Desktop file installed" || fail "Desktop file missing"
echo "$DEB_OUTPUT" | grep "ICON_FILE=OK" > /dev/null && pass "Icon installed" || fail "Icon missing"
echo "$DEB_OUTPUT" | grep "HAS_DEPENDS=1" > /dev/null && pass "Dependencies declared" || fail "Dependencies missing from package"

for CHECK in LDD_cw-key-helper LDD_ft4222-scope-reader LDD_libportaudio LDD_naudiodon LDD_libopus LDD_electron; do
  echo "$DEB_OUTPUT" | grep "${CHECK}=OK" > /dev/null && pass "$CHECK" || fail "$CHECK — missing libs"
done

# ── Phase 3: Test RPM on Fedora 39 ──────────────────────────────────

echo ""
echo -e "${BOLD}=== TEST: Fedora 39 — RPM install ===${RESET}"
RPM_OUTPUT=$(podman run --rm \
  --security-opt label=disable \
  -v "$PACKAGES_DIR:/packages:ro" \
  fedora:39 \
  bash -c '
    dnf install -y /packages/*.rpm > /dev/null 2>&1
    RESULT=$?
    echo "INSTALL_EXIT=$RESULT"

    echo "DESKTOP_FILE=$(test -f /usr/share/applications/rigcontrol-web.desktop && echo OK || echo MISSING)"
    echo "ICON_FILE=$(test -f /usr/share/icons/hicolor/512x512/apps/rigcontrol-web.png && echo OK || echo MISSING)"

    echo "RPM_DEPS=$(rpm -qR rigcontrol-web 2>/dev/null | grep -c -v rpmlib || echo 0)"

    for BIN in cw-key-helper ft4222-scope-reader; do
      F=$(find /opt -name "$BIN" -type f 2>/dev/null | head -1)
      if [ -n "$F" ]; then
        MISSING=$(ldd "$F" 2>&1 | grep "not found" || true)
        echo "LDD_${BIN}=${MISSING:-OK}"
      fi
    done

    PA=$(find /opt -name "libportaudio.so.2" -type f 2>/dev/null | head -1)
    if [ -n "$PA" ]; then
      MISSING=$(ldd "$PA" 2>&1 | grep "not found" || true)
      echo "LDD_libportaudio=${MISSING:-OK}"
    fi

    NA=$(find /opt -name "naudiodon.node" -type f 2>/dev/null | head -1)
    if [ -n "$NA" ] && [ -n "$PA" ]; then
      MISSING=$(LD_LIBRARY_PATH=$(dirname "$PA") ldd "$NA" 2>&1 | grep "not found" || true)
      echo "LDD_naudiodon=${MISSING:-OK}"
    fi

    LO=$(find /opt -name "libopus-node.glibc.node" -type f 2>/dev/null | head -1)
    if [ -n "$LO" ]; then
      MISSING=$(ldd "$LO" 2>&1 | grep "not found" || true)
      echo "LDD_libopus=${MISSING:-OK}"
    fi

    ELECTRON=$(find /opt -name "rigcontrol-web" -type f -executable 2>/dev/null | head -1)
    if [ -n "$ELECTRON" ]; then
      MISSING=$(ldd "$ELECTRON" 2>&1 | grep "not found" || true)
      echo "LDD_electron=${MISSING:-OK}"
    fi
  ' 2>&1)

echo "$RPM_OUTPUT" | grep "INSTALL_EXIT=0" > /dev/null && pass "RPM install succeeded" || fail "RPM install failed"
echo "$RPM_OUTPUT" | grep "DESKTOP_FILE=OK" > /dev/null && pass "Desktop file installed" || fail "Desktop file missing"
echo "$RPM_OUTPUT" | grep "ICON_FILE=OK" > /dev/null && pass "Icon installed" || fail "Icon missing"

for CHECK in LDD_cw-key-helper LDD_ft4222-scope-reader LDD_libportaudio LDD_naudiodon LDD_libopus LDD_electron; do
  echo "$RPM_OUTPUT" | grep "${CHECK}=OK" > /dev/null && pass "$CHECK" || fail "$CHECK — missing libs"
done

# ── Summary ──────────────────────────────────────────────────────────

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All checks passed.${RESET}"
else
  echo -e "${RED}${BOLD}$FAILURES check(s) failed.${RESET}"
  exit 1
fi
