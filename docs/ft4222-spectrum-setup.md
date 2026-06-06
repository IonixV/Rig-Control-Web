# FT-710 Spectrum Scope Setup (FT4222 USB)

The Yaesu FT-710 exposes its live spectrum waterfall over a dedicated USB connection using an FTDI FT4222H USB-to-SPI bridge chip. This is a separate USB device from the main CAT serial port and requires a proprietary userspace driver (`libft4222`) from FTDI.

This guide covers setup on Linux (Fedora 44 / RHEL-family), macOS, and Windows.

---

## How it works

The FT-710 presents two USB devices when connected:

| Device | Chip | Purpose |
|--------|------|---------|
| CP2105 (VID `10C4` / PID `EA70`) | Silicon Labs | CAT control serial port |
| FT4222H (VID `0403` / PID `601C`) | FTDI | Spectrum/waterfall SPI bridge |

RigControl Web's `ft4222-scope-reader` binary opens the FT4222H device directly via `libft4222`, reads 4096-byte SPI frames from the radio's DSP at the configured sweep rate, and streams parsed NDJSON spectrum data to the server. The server emits `spectrum-data` Socket.io events to all connected browser clients, which render the live panadapter and waterfall display.

This path is entirely separate from Hamlib and `rigctld`. The CAT port must still be connected and `rigctld` must be running for frequency/mode display to work alongside the spectrum.

---

## Hardware requirements

- Yaesu FT-710 (any variant)
- Two USB cables from the radio to the host: one for CAT (`CP2105`) and one for the spectrum scope (`FT4222H`)
- The radio's **USB Scope Out** feature must be enabled in the radio's menu (Menu → Scope → USB Scope Out → ON)

---

## Step 1 — Verify the FT4222 device is visible

With both USB cables connected and the radio powered on:

```bash
lsusb | grep -i "0403:601c"
```

Expected output:
```
Bus 001 Device 003: ID 0403:601c Future Technology Devices International, Ltd FT4222H
```

If you see only the CP2105 (VID `10C4`), the spectrum USB cable is not connected or the radio's USB Scope Out is disabled.

---

## Linux (Fedora 44 / RHEL-family)

### Step 2 — Download libft4222

FTDI does not publish `libft4222` to any Linux package manager. Download from FTDI directly:

```bash
cd ~/Downloads
wget https://ftdichip.com/wp-content/uploads/2022/06/libft4222-linux-1.4.4.170.tgz
tar -xzf libft4222-linux-1.4.4.170.tgz
cd libft4222-linux-1.4.4.170
```

> Check the [FT4222H Software Examples page](https://ftdichip.com/software-examples/ft4222h-software-examples/) to confirm you have the latest version. The filename will differ but the steps are identical.

### Step 3 — Install the library

Run the included installation script as root. It detects the system architecture (x86_64), copies the correct `.so` to `/usr/local/lib/`, creates symlinks, and runs `ldconfig`.

```bash
sudo ./install4222.sh
```

**If the script fails, install manually:**

```bash
sudo cp build-x86_64/libft4222.so.1.4.4.170 /usr/local/lib/
sudo ln -sf /usr/local/lib/libft4222.so.1.4.4.170 /usr/local/lib/libft4222.so.1
sudo ln -sf /usr/local/lib/libft4222.so.1          /usr/local/lib/libft4222.so
sudo ldconfig
```

> **Fedora path note:** FTDI's script installs to `/usr/local/lib`. Fedora x86_64 includes this in its ldconfig search path. If you ever get a runtime `libft4222.so not found` error, also copy the file to `/usr/local/lib64/` and re-run `sudo ldconfig`.

### Step 4 — Verify the library is discoverable

```bash
ldconfig -p | grep libft4222
```

Expected output:
```
libft4222.so.1 (libc6,x86-64) => /usr/local/lib/libft4222.so.1
```

If you see nothing, check that `/usr/local/lib` is in the ldconfig search path:

```bash
cat /etc/ld.so.conf.d/*.conf | grep local
```

If it is missing, add it:

```bash
echo "/usr/local/lib" | sudo tee /etc/ld.so.conf.d/local.conf
sudo ldconfig
```

### Step 5 — Fix SELinux context

Fedora ships with SELinux enforcing by default. After installation, restore the correct file context so the dynamic linker can load the library:

```bash
sudo restorecon /usr/local/lib/libft4222.so*
```

Verify the context is `lib_t`:

```bash
ls -lZ /usr/local/lib/libft4222.so*
# Expected: system_u:object_r:lib_t:s0
```

If `restorecon` does not fix it (shows `unlabeled_t`), set it explicitly:

```bash
sudo semanage fcontext -a -t lib_t '/usr/local/lib/libft4222\.so.*'
sudo restorecon /usr/local/lib/libft4222.so*
```

### Step 6 — udev rule for non-root access

Without this rule, the reader binary needs to run as root to open the USB device.

Create `/etc/udev/rules.d/50-ftdi-ft4222.rules`:

```bash
sudo tee /etc/udev/rules.d/50-ftdi-ft4222.rules > /dev/null << 'EOF'
# FTDI FT4222H (Yaesu FT-710 spectrum scope USB device)
SUBSYSTEM=="usb", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="601c", MODE="0660", TAG+="uaccess"
EOF
```

Reload rules and trigger:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Unplug and replug the radio's spectrum USB cable for the new rule to take effect on the existing device node.

> `TAG+="uaccess"` is the modern systemd-udev approach — it grants access to the currently logged-in seat user automatically, without requiring users to be added to a group.

---

## macOS

### Step 2 — Download libft4222

Download the macOS package from FTDI's [FT4222H Software Examples page](https://ftdichip.com/software-examples/ft4222h-software-examples/). The macOS archive is named `libft4222-mac-*.tar.gz` or similar.

Extract it and copy the `.dylib` to a library path:

```bash
sudo cp libft4222.1.dylib /usr/local/lib/
sudo ln -sf /usr/local/lib/libft4222.1.dylib /usr/local/lib/libft4222.dylib
```

macOS does not use `ldconfig`. The dynamic linker searches `/usr/local/lib` by default. Verify:

```bash
ls -l /usr/local/lib/libft4222*
```

### Step 3 — Allow the library past Gatekeeper

macOS will quarantine the downloaded `.dylib`. Remove the quarantine attribute:

```bash
sudo xattr -d com.apple.quarantine /usr/local/lib/libft4222.1.dylib
```

No udev equivalent is needed on macOS for USB device access. If the binary cannot open the device, check System Preferences → Security & Privacy → Privacy → USB for any blocking entries.

---

## Windows

### Step 2 — Install the FT4222 driver package

Download the Windows driver from FTDI's [FT4222H Software Examples page](https://ftdichip.com/software-examples/ft4222h-software-examples/). The archive contains:

- `ftd2xx.dll` — FTDI D2XX base driver
- `LibFT4222-64.dll` — FT4222 high-level library (64-bit)

Copy both DLLs to one of:
- `C:\Windows\System32\` (system-wide), or
- The directory where `ft4222-scope-reader.exe` lives (app-local)

The scope reader uses `LoadLibrary` to find these at runtime and will report a clear error if either is missing.

### Step 3 — Install the FTDI D2XX kernel driver

The FT4222 device requires FTDI's D2XX kernel driver instead of the default Windows USB Serial (CDC) driver. Use [Zadig](https://zadig.akeo.ie/) to switch the driver:

1. Open Zadig.
2. Options → List All Devices.
3. Select **FT4222H** from the dropdown.
4. Set the driver to **WinUSB** (or **libusbK**).
5. Click **Replace Driver**.

> This only affects the FT4222H interface — the CP2105 CAT serial port is unaffected.

No additional access control configuration is needed on Windows beyond the driver swap.

---

## Enabling the spectrum scope in RigControl Web

1. Open the **Spectrum Scope** panel settings (gear icon in the panel header).
2. Under **Spectrum Source**, select **FT-710 via USB**.
3. Toggle **Enable Spectrum Scope** on.
4. The **Reader running** indicator turns green when the `ft4222-scope-reader` binary has opened the device and is streaming data.

The panel title and waterfall will populate within one sweep cycle (typically < 1 second at default span).

---

## Troubleshooting

### Reader stopped / no green indicator

Check the error message shown in the settings modal under the status indicator. Common causes:

| Error | Cause | Fix |
|-------|-------|-----|
| `libft4222 not found` | Library not installed or not on ldconfig path | Re-run steps 3–4 above |
| `No FT4222 device found` | Radio not connected or USB Scope Out disabled | Check USB cable and radio menu |
| `LIBUSB_ERROR_ACCESS` / permission denied | udev rule not applied | Replug USB cable after reloading rules |
| `libft4222 not found` on macOS | Quarantine attribute blocking load | Run `xattr -d com.apple.quarantine` on the dylib |

### Verify reader binary works independently

Run the binary directly from a terminal:

```bash
./bin/linux/ft4222-scope-reader
```

On success you will see:

```
OPEN_OK
{"spanHz":200000,"modeVariant":1,"centerHz":14200000,...}
{"spanHz":200000,"modeVariant":1,"centerHz":14200000,...}
```

Press `Ctrl+C` to stop.

### Enable debug logging

Start the server with `--debug-spectrum` for detailed FT4222 reader lifecycle output:

```bash
npm run dev -- --debug-spectrum
```

In Electron:
```
rigcontrol-web --debug-spectrum
```

### libft4222 is not available from package managers

FTDI does not publish `libft4222` to any Linux distribution's package repositories (DNF, APT, AUR, etc.) as of mid-2026. It must always be installed from FTDI's website as described above.

---

## libftd2xx dependency

On **Linux and macOS**, `libft4222` has D2XX statically linked — a separate `libftd2xx` installation is **not** required.

On **Windows**, `ftd2xx.dll` must be present alongside `LibFT4222-64.dll` as described in the Windows section above.
