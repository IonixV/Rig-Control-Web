# Hamlib UDP Spectrum Scope Setup

RigControl Web can display a live panadapter and waterfall from several Icom radios by receiving spectrum data that Hamlib streams over a local UDP connection while `rigctld` is running.

**Supported radios:** IC-7300, IC-7300MK2, IC-7610, IC-7850/7851, IC-705, IC-9700, IC-905

No additional software or drivers are required — setup is entirely through the radio's menu and RigControl Web's settings.

---

## How it works

When `rigctld` is connected to one of these radios at 115200 baud, the radio automatically streams live spectrum data alongside normal CAT commands. RigControl Web captures that stream and renders it in the Spectrum Scope panel.

`rigctld` must be running and connected to the radio for the spectrum scope to work. The spectrum and rig control share the same USB connection.

---

## Step 1 — Configure the radio

All supported radios use the same menu path and the same four settings.

**Navigate to:** `MENU > SET > Connectors > CI-V`

On touchscreen models (IC-7300, IC-7300MK2, IC-7610, IC-7850/7851, IC-9700, IC-705, IC-905), tap **MENU**, then tap **SET**, then tap **Connectors**, and scroll down to the CI-V section.

Set the following four items:

| Setting | Required value |
|---------|---------------|
| **CI-V USB Port** | Unlink from \[REMOTE\] |
| **CI-V USB Baud Rate** | 115200 |
| **CI-V Transceive** | OFF |
| **CI-V USB Echo Back** | ON |

> **CI-V USB Port must be set to "Unlink from \[REMOTE\]" first.** When it is set to "Link to \[REMOTE\]", the radio caps the USB baud rate at 19200 and spectrum data cannot be streamed. Unlinking allows 115200 and makes the other settings take effect.

> **Why CI-V Transceive OFF?** RigControl Web uses polling — it asks the radio for its state on a regular interval. With Transceive ON, the radio also sends unsolicited updates whenever you touch a knob, which can confuse the communication and cause missed or out-of-order responses.

Power cycle the radio after making these changes so the new baud rate takes effect.

---

## Step 2 — Set the baud rate in RigControl Web

Open **General Settings** (gear icon), go to the **RIGCTLD** tab, and find the **Serial Speed** field under Server Side / Backend Settings.

Set it to **115200** to match the radio.

> The radio only streams spectrum data at 115200 baud. If RigControl Web's Serial Speed does not match the radio's CI-V USB Baud Rate setting, `rigctld` will connect but the spectrum waterfall will remain blank.

If `rigctld` was already running, click **Stop** then **Start** to restart it with the current settings.

---

## Step 3 — Enable the spectrum scope

1. Add the **Spectrum Scope** panel to your layout if it is not already visible (**Add Panel** in the layout toolbar).
2. Click the **gear icon** in the Spectrum Scope panel header to open its settings.
3. Set **Spectrum Source** to **Hamlib UDP**.
4. Turn on **Enable Spectrum Scope**.
5. Click **Stop** then **Start** (or **Kill and Restart**) in the RIGCTLD settings tab to restart `rigctld` with multicast enabled.

The waterfall should begin filling in within a few seconds of `rigctld` connecting.

---

## Troubleshooting

### Waterfall is blank after enabling

Check in order:

1. **Is `rigctld` running and connected?** The RIGCTLD status indicator in the settings panel should be green and show RUNNING. If it is red, check the Process Logs for errors.
2. **Is the radio's CI-V USB Baud Rate set to 115200?** This is the most common cause of a blank waterfall. Recheck the radio menu and power cycle after saving.
3. **Is CI-V USB Port set to "Unlink from \[REMOTE\]"?** Without this, the baud rate is capped and spectrum data is never sent.
4. **Did you restart `rigctld` after enabling the spectrum scope?** The multicast arguments are only passed when `rigctld` is started with the scope enabled. Stop and start it again.

### rigctld stops immediately after enabling the spectrum scope

RigControl Web automatically detects this and turns the spectrum scope toggle back off. This means the `rigctld` binary on your system was built without multicast support.

Check the **Process Logs** panel for the error message. To resolve it:
- On Linux, install a recent Hamlib package (`hamlib` or `libhamlib-utils`, version 4.x or later). The version bundled with the app supports multicast.
- On Windows, use the `rigctld.exe` bundled with RigControl Web rather than a separately installed one.

### Spectrum appears but looks wrong or unstable

- **CI-V Transceive is ON** — set it to OFF and restart `rigctld`. With Transceive ON, unsolicited updates from the radio arrive between polled responses and can cause the spectrum stream to misalign.
- **Baud rate mismatch** — if rig control works but the spectrum is garbled, double-check that both the radio's CI-V USB Baud Rate and `rigctld`'s connection rate are consistent.

### Spectrum scope works, but rig control stops responding periodically

This can happen if another program (logging software, digital mode software) is also connected to `rigctld` and sending CI-V commands at a high rate. Try increasing the **Poll Rate** in RigControl Web's RIGCTLD settings from the default to 2000–3000 ms to reduce contention.

---

## Using the spectrum alongside other software

Because `rigctld` presents a standard network interface, logging programs like WSJT-X, FLDigi, and JS8Call can connect to the same `rigctld` instance alongside RigControl Web. In those programs, choose **Hamlib NET rigctl** as the rig type and point it at `127.0.0.1:4532`.

All programs share the radio connection. The spectrum scope continues to work as long as `rigctld` remains running.
