#!/bin/bash
#
# setup-virtual-audio.sh — Create/remove virtual audio devices for WSJTX integration.
# Works with PulseAudio and PipeWire (PulseAudio compatibility layer).
#
# Usage:
#   ./scripts/setup-virtual-audio.sh          # create virtual devices
#   ./scripts/setup-virtual-audio.sh setup     # same as above
#   ./scripts/setup-virtual-audio.sh teardown  # remove virtual devices
#

set -e

RX_SINK="rcw_wsjtx_rx"
TX_SINK="rcw_wsjtx_tx"
RX_DESC="RCW-WSJTX-RX"
TX_DESC="RCW-WSJTX-TX"

check_pactl() {
    if ! command -v pactl &>/dev/null; then
        echo "ERROR: pactl not found. Install PulseAudio or PipeWire with PulseAudio compatibility."
        exit 1
    fi
}

do_setup() {
    check_pactl

    # Check if sinks already exist
    if pactl list short sinks 2>/dev/null | grep -q "$RX_SINK"; then
        echo "Virtual sink '$RX_SINK' already exists — skipping."
    else
        pactl load-module module-null-sink \
            sink_name="$RX_SINK" \
            sink_properties=device.description="$RX_DESC"
        echo "Created sink: $RX_DESC"
    fi

    if pactl list short sinks 2>/dev/null | grep -q "$TX_SINK"; then
        echo "Virtual sink '$TX_SINK' already exists — skipping."
    else
        pactl load-module module-null-sink \
            sink_name="$TX_SINK" \
            sink_properties=device.description="$TX_DESC"
        echo "Created sink: $TX_DESC"
    fi

    echo ""
    echo "Virtual audio devices ready."
    echo ""
    echo "In RigControl Web (Audio Settings → WSJTX Bridge):"
    echo "  WSJTX Audio Output:  $RX_DESC"
    echo "  Local Input (Mic):   Monitor of $TX_DESC"
    echo ""
    echo "In WSJTX (Settings → Audio):"
    echo "  Soundcard Input:     Monitor of $RX_DESC"
    echo "  Soundcard Output:    $TX_DESC"
}

do_teardown() {
    check_pactl

    # Unload specific null-sink modules by sink name
    for sink in "$RX_SINK" "$TX_SINK"; do
        local module_id
        module_id=$(pactl list short modules 2>/dev/null | grep "sink_name=$sink" | cut -f1)
        if [ -n "$module_id" ]; then
            pactl unload-module "$module_id"
            echo "Removed sink: $sink (module $module_id)"
        else
            echo "Sink '$sink' not found — skipping."
        fi
    done

    echo "Virtual audio devices removed."
}

case "${1:-setup}" in
    setup)    do_setup ;;
    teardown) do_teardown ;;
    *)
        echo "Usage: $0 [setup|teardown]"
        exit 1
        ;;
esac
