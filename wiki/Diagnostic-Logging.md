# Diagnostic Logging

When something is not working as expected — audio cutting out, the rig not connecting, the keyer misbehaving — diagnostic logging captures a detailed trace of what the app is doing internally. This output is the most useful thing you can include in a bug report.

---

## How to Enable Diagnostic Logging

RigControl Web supports six diagnostic flags. Launch the app with one or more of them to enable logging for the relevant subsystem:

| Flag | What it captures |
|------|-----------------|
| `--debug-rig` | Hamlib command traffic, capability detection, poll cycle, VFO probe |
| `--debug-audio` | Audio pipeline — encoding, decoding, device selection, jitter buffer activity |
| `--debug-video` | Video chunk relay, encoder and decoder events |
| `--debug-cw` | CW keyer state machine, DTR/RTS serial line changes |
| `--debug-infra` | Server startup, shutdown steps, TLS certificate, settings file reads/writes |
| `--debug-all` | All of the above at once |

Flags can be combined. For example, if your problem involves audio and the rig connection together, use `--debug-rig --debug-audio`.

**If you are unsure which flag to use, use `--debug-all`.** It produces more output but guarantees nothing is missed.

---

## Launching With a Debug Flag

### Windows (Electron App)

Open a Command Prompt, then run:

```
"C:\Program Files\RigControl Web\RigControl Web.exe" --debug-all
```

The path may vary depending on where you installed the app. You can also find the executable by right-clicking the Start Menu shortcut → **Open file location**.

Server-side log output appears in the Command Prompt window. Keep this window open while you reproduce the problem.

### Linux (AppImage)

Open a terminal, then run the AppImage directly:

```
./RigControl-Web-<version>.AppImage --debug-all
```

If you installed the app to a specific location, use its full path. Server-side log output appears in the terminal. Keep the terminal open while you reproduce the problem.

### Development (from Source)

```
npm run dev -- --debug-all
```

Log output appears in the terminal where you ran the command.

---

## Capturing the Output

### Server-Side Logs (Terminal)

The server-side diagnostic output prints in the terminal or Command Prompt where you launched the app. To save it to a file for attaching to a bug report:

**Windows:**
```
"RigControl Web.exe" --debug-all > rigcontrol-log.txt 2>&1
```

**Linux:**
```
./RigControl-Web-<version>.AppImage --debug-all > rigcontrol-log.txt 2>&1
```

This creates a `rigcontrol-log.txt` file in the current directory containing everything printed to the console.

### Browser-Side Logs (DevTools Console)

Diagnostic flags are also forwarded to connected browser clients. Browser-side output (audio pipeline events, video decoder events, keyer state transitions) appears in the **DevTools console** of the browser tab running the app.

To open DevTools:

- **Chrome / Edge:** Press `F12` or `Ctrl+Shift+J` (Windows/Linux) / `Cmd+Option+J` (macOS)
- **Firefox:** Press `F12` or `Ctrl+Shift+K`
- **Safari:** Enable the Developer menu in Preferences → Advanced, then press `Cmd+Option+C`

Switch to the **Console** tab. Filter by `[RIG]`, `[AUDIO]`, `[VIDEO]`, `[CW]`, or `[INFRA]` to narrow down to the relevant subsystem.

To save the console output: right-click anywhere in the Console panel → **Save as...** (Chrome/Edge) or copy the visible output.

---

## What to Include in a Bug Report

A useful bug report includes:

1. **A description of what you expected to happen and what actually happened.**
2. **Steps to reproduce** — what you clicked, in what order, starting from a fresh launch.
3. **Server-side log output** (the terminal output with `--debug-all`), captured from just before and during the problem.
4. **Browser console output** (DevTools console), captured during the same window.
5. **Your setup:** operating system, RigControl Web version, radio model, and how it is connected (USB audio, Digirig, etc.).

Attach the log files or paste the relevant sections as text in the bug report. Logs with timestamps are especially helpful — the server prefixes lines with step context, and the browser console timestamps each entry.

**File a bug report at:** [https://github.com/jbdubbs/Rig-Control-Web/issues](https://github.com/jbdubbs/Rig-Control-Web/issues)
