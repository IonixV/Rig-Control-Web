# Audio I/Q Spectrum Setup

RigControl Web can drive its spectrum waterfall from a radio's baseband I/Q output, captured through a stereo USB audio interface. This is the third spectrum source alongside Hamlib UDP and the FT-710's FT4222 USB-SPI bridge — it's generic (any radio with a baseband I/Q output on a stereo jack should work), but it has only been tested against the **Xiegu G90**.

This guide uses the G90 and a StarTech ICUSBAUDIO2D as the concrete example; substitute your own radio/adapter as needed.

---

## How it works

Unlike the FT4222 path (a dedicated USB-SPI chip reading digital spectrum data), this source is pure audio: the radio outputs a low-level analog I/Q signal on a stereo jack, a USB sound card digitizes it, and RigControl Web computes a live FFT from the captured PCM directly in the server process — no radio-specific driver or child binary involved.

**Span = sample rate.** Because I/Q (complex) sampling covers a full `±sample_rate/2` band around the tuned frequency — unlike ordinary real-valued audio sampling, which only covers half that — the displayed span always equals whatever sample rate you select for the capture device (48 kHz capture → 48 kHz span, 96 kHz → 96 kHz, and so on).

**But the radio's real bandwidth doesn't grow with sample rate.** The G90's I/Q output is an analog reproduction of its own internal 48 kHz-sampling SDR core — its true usable bandwidth is fixed by the radio's own hardware, not by how fast you digitize it. Capturing at 96 kHz instead of 48 kHz mainly buys headroom against aliasing (and, per user reports with this radio, does reveal usable content beyond what 48 kHz capture alone can show, since 48 kHz sampling's Nyquist limit clips some of what the radio actually outputs) — but going well beyond 96 kHz on the capture side won't hand you more real spectrum from a radio whose own SDR core tops out around there. Treat higher sample rates as "avoids clipping the radio's real output," not as "the radio suddenly has more bandwidth."

---

## Wiring

1. Connect a 3.5mm TRS cable from the radio's I/Q output port to the USB audio interface's **Line-In** jack.
2. **Do not use a Mic-In jack.** Many mic inputs supply plug-in-power (a small bias voltage) to support electret microphones — feeding that back into the radio's low-level (~50–100mV) I/Q output is not something the port is designed to tolerate. Line-In jacks don't carry this bias voltage.
3. Connect the USB audio interface to this computer.

---

## Configuring RigControl Web

1. Open the **Spectrum Scope** panel settings (gear icon in the panel header).
2. Under **Spectrum Source**, select **Audio I/Q**.
3. Turn on **Enable Spectrum Scope**.
4. Under **Capture Device**, select your USB audio interface. The list is populated from the same device enumeration used for the radio's backend audio settings.
5. Under **Sample Rate (Span)**, pick the rate you want to capture at. Higher rates need a capable adapter (the StarTech ICUSBAUDIO2D supports up to 96 kHz) — if the device rejects a rate, an error will appear next to the status indicator.
6. The **Capture running** indicator turns green once the app has successfully opened the audio device.

The waterfall should appear within a second or two.

### Fixing a mirrored spectrum

If a signal you expect to see on one side of center consistently appears on the other side (or a known upper-sideband signal shows its image more strongly than the real signal), the left/right channels are swapped relative to what RigControl Web expects as I vs Q. Toggle **Swap I/Q** in the panel settings — this is the same fix HDSDR uses for the G90's own "Swap IQ" option, and has the identical effect here.

### Tuning the noise floor / ceiling

The Noise Floor and Ceiling sliders control display contrast, the same as the other two spectrum sources. There is no calibrated absolute reference for this path (the G90's I/Q output level isn't documented to a precise spec, and any adapter's input gain further changes the effective level), so the defaults are starting points — adjust them against your own setup until the waterfall shows good contrast between the noise floor and real signals.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "No I/Q capture device selected" | No device chosen yet | Pick a device under Capture Device |
| "Configured I/Q capture device not found" | The saved device isn't currently connected/enumerated | Reconnect the USB adapter, then reselect it in the dropdown |
| "Audio engine not ready (naudiodon failed to load)" | The bundled `naudiodon` native module failed to load at startup | Check the startup log for the underlying `naudiodon` load error (same audio engine used for regular radio audio) |
| "Failed to open I/Q capture device" | The device doesn't support the selected sample rate, or is in use by another application | Try a lower sample rate, or close other apps using the device |
| Waterfall is flat/empty | Cable on Mic-In instead of Line-In, radio's I/Q output not actually active, or wrong device selected | Recheck wiring; confirm the correct capture device is selected |
| Signal appears mirrored / on the wrong side of center | Left/right channels don't match RigControl Web's I/Q convention | Toggle **Swap I/Q** |

### Check the debug log

Start RigControl Web with `--debug-spectrum` for a detailed trace of the I/Q capture pipeline:

```bash
npm run dev -- --debug-spectrum
```
