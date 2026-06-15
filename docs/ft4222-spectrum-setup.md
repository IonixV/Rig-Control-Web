# FT-710 Spectrum Scope Setup

The Yaesu FT-710 can stream its live spectrum waterfall to RigControl Web over USB. This requires installing a small driver library (libft4222) from FTDI on your computer, and enabling the feature in the radio's settings.

This guide covers Linux (Fedora/RHEL and Debian/Ubuntu), macOS, and Windows.

---

## Before you start

### One USB cable, three devices

Your FT-710 uses a single USB cable. When connected, your computer sees three separate USB devices exposed by that one cable:

| Device | Purpose |
|--------|---------|
| CP2105 (Silicon Labs) | CAT control serial port — used by rigctld |
| FT4222H (FTDI) | Spectrum scope data stream |
| USB Audio | Radio audio over USB |

You do not need a second cable for the spectrum scope.

### Enable the spectrum output on the radio

The spectrum USB output is off by default. Turn it on through the FT-710's menu:

1. Press the **FUNC** knob to open the menu.
2. Rotate or touch to **OPERATION SETTING**, then press **FUNC** to enter it.
3. Navigate to **GENERAL**.
4. Find **SCU-LAN10** and set it to **ON**.
5. Press **FUNC** (or wait about 3 seconds) to save the setting.
6. Touch **BACK** to return to normal operation.

---

## Linux

### Step 1 — Confirm the device is visible

With the radio connected and powered on, open a terminal and run:

```bash
lsusb | grep -i "0403:601c"
```

Expected output:
```
Bus 001 Device 003: ID 0403:601c Future Technology Devices International, Ltd FT4222H
```

If nothing appears, check that the USB cable is fully seated and that SCU-LAN10 is enabled in the radio (see above).

### Step 2 — Download libft4222

FTDI does not publish `libft4222` through any Linux package manager — you must download it directly from FTDI.

Go to the [FT4222H Software Examples page](https://ftdichip.com/software-examples/ft4222h-software-examples/) and download the Linux package. Then extract it:

```bash
cd ~/Downloads
tar -xzf libft4222-linux-*.tgz
cd libft4222-linux-*
```

### Step 3 — Install the library

Run the included installation script:

```bash
sudo ./install4222.sh
```

This copies the library to `/usr/local/lib/` and updates the linker cache.

**If the script fails, install manually:**

```bash
sudo cp build-x86_64/libft4222.so.1.4.4.170 /usr/local/lib/
sudo ln -sf /usr/local/lib/libft4222.so.1.4.4.170 /usr/local/lib/libft4222.so.1
sudo ln -sf /usr/local/lib/libft4222.so.1          /usr/local/lib/libft4222.so
sudo ldconfig
```

### Step 4 — Verify the library is found

```bash
ldconfig -p | grep libft4222
```

You should see at least one line referencing `libft4222.so.1`.

**If you see nothing**, `/usr/local/lib` may not be in the linker's search path — this is common on Debian and Ubuntu. Fix it:

```bash
echo "/usr/local/lib" | sudo tee /etc/ld.so.conf.d/local.conf
sudo ldconfig
```

Then re-run `ldconfig -p | grep libft4222` to confirm.

> **Fedora / RHEL:** If you still get a "not found" error at runtime, also copy the file to `/usr/local/lib64/` and re-run `sudo ldconfig`.

### Step 5 — Fix SELinux context (Fedora / RHEL only)

Fedora and RHEL run SELinux enforcing by default. Apply the correct file context so the library can be loaded:

```bash
sudo restorecon /usr/local/lib/libft4222.so*
```

Verify the context is `lib_t`:

```bash
ls -lZ /usr/local/lib/libft4222.so*
# Expected: system_u:object_r:lib_t:s0
```

If `restorecon` does not fix it (context shows `unlabeled_t`):

```bash
sudo semanage fcontext -a -t lib_t '/usr/local/lib/libft4222\.so.*'
sudo restorecon /usr/local/lib/libft4222.so*
```

> **Debian / Ubuntu:** SELinux is not used on these distributions — skip this step entirely.

### Step 6 — Allow non-root access to the USB device

Without this step, RigControl Web would need to run as root to read from the FT4222H. Create a udev rule to grant access automatically:

```bash
sudo tee /etc/udev/rules.d/50-ftdi-ft4222.rules > /dev/null << 'EOF'
# FTDI FT4222H (Yaesu FT-710 spectrum scope)
SUBSYSTEM=="usb", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="601c", MODE="0660", GROUP="dialout", TAG+="uaccess"
EOF
```

This rule grants access two ways: `TAG+="uaccess"` covers users logged into the local graphical desktop (seat0), and `GROUP="dialout"` covers everyone else — including remote-desktop/RDP sessions, which systemd-logind does not treat as seat sessions and therefore does not grant `uaccess` ACLs to. Make sure your user is in the `dialout` group (the same group used for the radio's CAT serial port):

```bash
sudo usermod -aG dialout $USER
```

(Log out and back in for the new group membership to take effect.)

Apply the rule:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Unplug and reconnect the USB cable so the rule takes effect on the device.

> **Remote desktop / headless setups:** If you connect to this machine via a remote desktop session (e.g. GNOME Remote Desktop/RDP, VNC, X11 forwarding), `uaccess` alone is not enough — only `GROUP="dialout"` will grant your session access. If the scope still reports `device not found (status 2)` after confirming the device is connected and the library is installed, check `getfacl /dev/bus/usb/<bus>/<device>` (from `lsusb`) and confirm your user is in `dialout` (`groups`).

---

## macOS

### Step 1 — Confirm the device is visible

With the radio connected and powered on, open Terminal and run:

```bash
system_profiler SPUSBDataType | grep -A5 "FT4222"
```

You should see an entry for the FT4222H. If nothing appears, check the USB connection and confirm SCU-LAN10 is enabled in the radio (see above).

### Step 2 — Download and install libft4222

Go to the [FT4222H Software Examples page](https://ftdichip.com/software-examples/ft4222h-software-examples/) and download the macOS package.

Extract the archive and install the library:

```bash
sudo cp libft4222.1.dylib /usr/local/lib/
sudo ln -sf /usr/local/lib/libft4222.1.dylib /usr/local/lib/libft4222.dylib
```

Verify the files are in place:

```bash
ls -l /usr/local/lib/libft4222*
```

### Step 3 — Remove the macOS quarantine flag

macOS marks files downloaded from the internet as quarantined. Remove the flag so the library can be loaded:

```bash
sudo xattr -d com.apple.quarantine /usr/local/lib/libft4222.1.dylib
```

No further configuration is needed for USB device access on macOS. If the app still cannot open the device, check **System Settings → Privacy & Security** for anything blocking USB access.

---

## Windows

### Step 1 — Confirm the device is visible

With the radio connected and powered on, open **Device Manager** (right-click the Start button → Device Manager).

Expand **Universal Serial Bus controllers** (or **Universal Serial Bus devices**) and look for **FT4222H**. If it is listed, the device is recognized.

If it does not appear, check the USB connection and confirm SCU-LAN10 is enabled in the radio (see above).

> The CP2105 CAT serial port will appear separately under **Ports (COM & LPT)** — this is expected.

### Step 2 — Replace the default FTDI driver

Windows loads the wrong driver for the FT4222H by default. Use [Zadig](https://zadig.akeo.ie/), a free utility, to replace it:

1. Download and open **Zadig**.
2. From the menu, choose **Options → List All Devices**.
3. Select **FT4222H** from the dropdown.
4. Set the target driver to **WinUSB**.
5. Click **Replace Driver**.

> This only affects the FT4222H spectrum device — the CP2105 CAT serial port is untouched.

### Step 3 — Install the FT4222 library files

Go to the [FT4222H Software Examples page](https://ftdichip.com/software-examples/ft4222h-software-examples/) and download the Windows package. It contains two files:

- `ftd2xx.dll`
- `LibFT4222-64.dll`

Copy both files to **one** of these locations:

- `C:\Windows\System32\` — available to all applications system-wide
- The folder where `RigControl Web.exe` is installed — keeps them alongside the app

RigControl Web will show a clear error on startup if either file is missing.

---

## Enabling the spectrum scope in RigControl Web

Once the library is installed:

1. Open the **Spectrum Scope** panel settings (gear icon in the panel header).
2. Under **Spectrum Source**, select **FT-710 via USB**.
3. Turn on **Enable Spectrum Scope**.
4. The **Reader running** indicator turns green when the app has successfully connected to the device.

The waterfall should appear within a second or two. If it does not, check the error message next to the status indicator.

---

## Troubleshooting

### Status indicator is not green

Check the error message shown in the Spectrum Scope settings panel.

| Error | Most likely cause | Fix |
|-------|-------------------|-----|
| `libft4222 not found` | Library not installed or not on search path | Redo the install steps for your platform |
| `No FT4222 device found` | Radio not connected, or SCU-LAN10 not enabled | Check USB cable and radio menu |
| `LIBUSB_ERROR_ACCESS` / permission denied | udev rule missing or not applied (Linux) | Redo Step 6 and replug the USB cable |
| `device not found (status 2)` despite `lsusb` showing the device | Permission denied on the device node — common over remote desktop/RDP sessions, where `uaccess` ACLs are not granted | Redo Step 6 with `GROUP="dialout"`, confirm your user is in `dialout` (`groups`), then replug the USB cable |
| `libft4222 not found` on macOS | Quarantine flag still set | Run the `xattr -d` command from Step 3 |

### Check the debug log

Start RigControl Web with `--debug-spectrum` for a detailed trace of the spectrum reader's activity:

**From the command line:**
```bash
./RigControl-Web-<version>.AppImage --debug-spectrum
```

**In development:**
```bash
npm run dev -- --debug-spectrum
```

Output appears in the terminal where you launched the app.

### libft4222 is not available from package managers

FTDI does not publish `libft4222` to any Linux distribution's package repositories (DNF, APT, AUR, etc.) as of mid-2026. It must always be installed manually from FTDI's website as described above.
