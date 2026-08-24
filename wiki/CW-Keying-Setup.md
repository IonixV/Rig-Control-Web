# CW Keying Setup

This page explains how to set up the CW keyer in RigControl Web so that your radio actually transmits CW when you press the paddles or keyboard keys. If you have already enabled the keyer and hear local sidetone but the radio either does nothing or keys up without producing a CW tone, this page will help you fix that.

---

## How CW Keying Works

When you press a paddle or key in RigControl Web, the app needs a way to tell your radio "key down" and "key up." It does this by toggling a control line on a serial (USB) port — the same kind of USB cable you already use to control your radio.

Most radios that support USB CW keying have a setting in their menu that watches for this signal. When the app raises the line, the radio keys down and produces a CW tone. When the app lowers the line, the radio keys up.

---

## Quick Setup Summary

There are three things to configure:

1. **Your radio's menu** — Tell the radio which USB line to watch for CW keying.
2. **RigControl Web's keyer settings** — Tell the app which USB port and line to use.
3. **Verify the connection** — Confirm the port opens successfully and test with a key press.

The sections below walk through each step in detail.

---

## Step 1: Radio Menu Settings

Your radio needs to know that CW keying commands will arrive over its USB cable. The exact menu names vary by manufacturer, but the concept is the same: you assign the USB CW keying function to a specific control line (DTR or RTS), and you make sure nothing else is using that same line.

### Icom IC-7300

The IC-7300 is the most common case, so it is covered in detail here.

Open the radio's menu and navigate to **SET > Connectors > USB SEND/Keying**. You will see two settings:

| Radio menu item | Set it to | Why |
|----------------|-----------|-----|
| **USB Keying (CW)** | **DTR** | This tells the radio to watch the DTR line on its USB port for CW key-down / key-up signals. |
| **USB Send** | **RTS** or **OFF** | This must be set to something *other than* DTR. The radio does not allow both settings to use the same line. If USB Send is also set to DTR, neither will work. |

> **Important:** If you set both USB Keying (CW) and USB Send to the same line (for example, both to DTR), the radio will ignore both. Make sure they are different.

### Other Radios

If your radio supports CW keying over USB, look for a similar menu — it is usually under a "Connectors," "USB," or "Keying" section. Assign the CW keying function to DTR (or RTS if your radio only offers that), and make sure no other function is assigned to the same line.

---

## Step 2: App Settings

Open RigControl Web and click the **gear icon** (&#9881;) in the top-right corner to open General Settings, then select the **CW** tab.

### Enable the Keyer

Toggle **Enable CW Keyer** on if it is not already enabled.

### Choose the Keying Method

Under **Keying Method**, you will see three buttons: **DTR**, **RTS**, and **CAT PTT**.

- Select **DTR** if you set your radio's USB CW keying to DTR in Step 1 (this is the most common choice).
- Select **RTS** if your radio uses the RTS line instead.
- **Do not use CAT PTT** for CW keying on most radios. CAT PTT only toggles the transmitter on and off — it does not send the CW keying signal. Your radio will key up (go into transmit) but will not produce a CW tone.

> **This is the most common mistake.** If your radio keys up but you hear no CW tone, you almost certainly have CAT PTT selected. Switch to DTR or RTS.

### Enter the Keyer Serial Port

A field labeled **Keyer Serial Port** appears when DTR or RTS is selected. Click it to see serial devices detected on the machine running RigControl Web, or type the path to your radio's USB serial port by hand — the same port you use for rig control.

| Operating system | Example |
|-----------------|---------|
| Linux | `/dev/ttyUSB0` or `/dev/serial/by-id/usb-Silicon_Labs_...` |
| macOS | `/dev/cu.SLAB_USBtoUART` or `/dev/cu.usbserial-...` |
| Windows | See the Windows section below |

> **Tip:** This is usually the same port listed in the **RIGCTLD** tab under Serial Port. On Linux and macOS, the app and `rigctld` can share the same port without any conflict.

After you enter the port and press Tab or click away, the status indicator next to the field should change to **OPEN** (green). If it shows **ERROR**, see the Troubleshooting section below.

### Key Polarity

Leave **Key Polarity** set to **Active High** unless you know your setup requires Active Low. Almost all radios and USB interfaces use Active High.

---

## Step 3: Test It

1. Make sure your radio is in a CW mode (CW or CW-R).
2. Make sure `rigctld` is running and connected (green status in the RIGCTLD tab).
3. Press a paddle key (Left Ctrl for dit, Right Ctrl for dah by default) or tap the touch paddles on a phone.
4. You should hear both your local sidetone in the browser **and** the radio should key up and produce a CW tone.

If the radio keys up but produces no tone, go back and check that you are using **DTR** (not CAT PTT) in the app, and that your radio's **USB Keying (CW)** menu is also set to **DTR**.

---

## Windows: Single-Port Limitation

On Windows, only one program can use a serial port at a time. Since `rigctld` is already using your radio's USB port for rig control, the CW keyer cannot open the same port and will show an **ERROR** status.

There are two ways to work around this:

### Option A: Use a Separate USB-to-Serial Adapter

Plug a second USB-to-serial adapter (such as a Digirig, SignaLink USB, or a simple USB-to-TTL cable) into your computer and wire its DTR or RTS line to your radio's key jack. Then:

- In the **RIGCTLD** tab, keep the Serial Port set to your radio's built-in USB port (e.g. `COM3`).
- In the **CW** tab, set the Keyer Serial Port to the *adapter's* port (e.g. `COM5`).

This gives `rigctld` and the keyer their own separate ports with no conflict.

### Option B: Use a Serial Port Splitter

Splitter software lets both `rigctld` and the CW keyer talk to the radio's *one* real USB port at the same time by presenting each of them with their own virtual port and relaying the real port's traffic between all of them. Point `rigctld` at one virtual port and the CW keyer's Keyer Serial Port at the other; neither ever touches the real port directly.

A plain [com0com](https://com0com.com/) pair is **not** enough by itself — a bare pair just connects two virtual ports to each other, with nothing relaying to the real radio port. You need an actual splitter/hub on top of it. A few options, roughly in order of "free and a bit more setup" to "paid and turnkey":

| Tool | Cost | Notes |
|------|------|-------|
| **com0com + hub4com** | Free, open source | com0com creates the virtual port pairs; its bundled `hub4com` utility is the actual splitter that bridges the real port to them. Signed driver, works on Windows 10/11. Command-line `hub4com` config, so more setup than the others. |
| **[VSPE (Virtual Serial Ports Emulator)](https://www.eterlogic.com/Products.VSPE.html)** | Free | Has a built-in **Splitter** device type in its GUI made for exactly this case — pick the real port as the source and add virtual ports as outputs, no separate hub tool needed. Simplest free option to configure. |
| **[FabulaTech Serial Port Splitter](https://www.fabulatech.com/serial-port-splitter.html)** (or Eltima's equivalent) | Paid (~$40–70) | Polished GUI, official Windows 11 support and vendor support. Worth it if the free tools hit driver-signing issues or a less technical user needs a turnkey install. |

Whichever tool you pick, remember the two virtual ports it creates go one to `rigctld`'s **RIGCTLD** tab Serial Port field, and the other to the **CW** tab's Keyer Serial Port field — never point either of them at the real port once the splitter owns it.

> **Linux and macOS users:** This limitation does not apply to you. Both `rigctld` and the CW keyer can share the same USB port at the same time without any special configuration.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Radio keys up (transmits) but no CW tone | **CAT PTT** is selected instead of DTR or RTS | Change Keying Method to **DTR** and set your radio's USB Keying (CW) menu to match |
| Keyer Serial Port shows **ERROR** | Port path is wrong, radio is not plugged in, or (Windows only) the port is locked by `rigctld` | Double-check the port path. On Windows, use a separate adapter or a serial port splitter (see above) |
| Keyer Serial Port shows **ERROR** with "permission denied" | (Linux) Your user account does not have access to the serial port | Run `sudo usermod -aG dialout $USER` in a terminal, then log out and back in |
| Port shows **OPEN** but nothing happens when keying | Radio's USB Keying (CW) menu is set to a different line than the app, or is turned OFF | Make sure both the radio menu and the app agree on DTR (or RTS) |
| CW tone works but timing is erratic or characters are garbled | Network latency between browser and server | Make sure you are running the app on the same computer as the radio, or on the same local network. The keyer compensates for moderate latency but very high latency will affect timing |
| "cw-key-helper binary not found" error | The helper program is missing | If running from source, run `npm run build:cw-helper`. If using an installer, reinstall the app |
| Stuck-key alert fires (5-second watchdog) | A key event was held too long, possibly due to a lost connection or stuck paddle contact | Release all keys. The keyer will automatically unlock once all paddles are released. If it keeps happening, check your paddle wiring |
