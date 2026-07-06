# Audio and Video

RigControl Web supports two-way audio (transmit and receive) and a live video feed of your radio's front panel. These are now surfaced as two separate panels — **Audio Feed** and **Video Feed** — each with its own settings modal. You can place them independently in your layout, and the Audio Feed panel is useful even on rigs that have no video output.

---

## Audio Feed Panel

The **Audio Feed** panel is a slim control strip. It has no expandable body — all of its controls live in the panel header:

- **Join Audio** button — appears when a backend audio session is running but you have not yet connected your local devices to it.
- **Inbound mute** (headphone icon) — mutes received audio in your local speakers; the radio keeps receiving.
- **Outbound mute** (microphone icon) — mutes your local mic so your voice is not sent to the radio even if you key PTT.
- **Gear icon** — opens **Audio Settings**.

---

## Opening Audio Settings

Click the **gear icon** in the **Audio Feed** panel header to open Audio Settings. This is where you configure your microphone, speakers, volume, and the backend audio engine.

---

## Audio

The audio system lets you speak into your microphone and hear received audio through your speakers — just like operating from the shack, even when you are accessing the app remotely. Audio uses the Opus codec, which provides good voice quality at low bandwidth.

### Understanding the Two Audio Subsystems

This is the most important concept in the audio setup. RigControl Web has **two separate audio configurations**, and it is critical to understand what each one does:

**Backend Audio Engine (Server Side)**
> This is the audio hardware physically connected to your radio on your shack computer — for example, a Digirig, a USB audio interface, or your radio's built-in USB audio device. The backend audio engine runs on the server and is always tied to the hardware in your shack, regardless of where you are connecting from.
>
> - **Backend Input (Mic/Line)** — the audio coming *from* your radio into the computer (receive audio)
> - **Backend Output (Speakers)** — the audio going *to* your radio from the computer (transmit audio)

**Local Client Audio (Your System)**
> This is the microphone and speakers on *whatever device you are using to access the app* — your shack desktop, your laptop at a hotel, your phone in the other room. These are the devices you will actually speak into and listen through.
>
> - **Local Input (Microphone)** — your mic; what you speak into to transmit
> - **Local Output (Speakers/Headphones)** — your speakers or headphones; where you hear received audio

Think of it this way: **backend audio = the radio's end; local audio = your end**.

![RigControl Web — Audio Settings](https://raw.githubusercontent.com/jbdubbs/Rig-Control-Web/main/assets/rigcontrolweb.manual.audio.settings.png)

---

### Configuring Local Client Audio

1. Open Audio Settings (gear icon in the **Audio Feed** panel header).
2. Under **Local Client Audio (Your System)**, select your microphone from the **Local Input (Microphone)** dropdown and your speakers or headphones from the **Local Output (Speakers/Headphones)** dropdown.
3. Use the **Local Speaker Volume** slider (directly below the Local Output dropdown) to set the playback volume for received audio.
4. These settings are saved in your browser and apply only to your device — a different device connecting to the same server will have its own local audio settings.

> **Browser permission:** The first time you use audio, your browser will ask for permission to access your microphone. You must allow this for transmit audio to work. If your microphone devices show without names (just "Input 1", etc.), click **Request Permission** next to the dropdown to prompt the browser permission dialog.

> **Device changes apply immediately** — you do not need to stop and restart audio when switching local devices or adjusting the speaker volume.

---

### Configuring Backend Audio

> The backend audio settings are configured once on the server (the shack computer). They do not need to be changed when connecting from a different device.

1. Open Audio Settings (gear icon in the **Audio Feed** panel header).
2. Scroll down to the **Backend Audio Engine** section. It shows a **READY** or **FAILED** status badge indicating whether the audio hardware initialized correctly.

> **Linux: device list empty or status shows FAILED?** On most Linux distributions, access to sound devices (`/dev/snd/*`) is restricted to users in the `audio` group. If the Backend Audio Engine shows **FAILED**, or the Backend Input/Output dropdowns are empty, add your user to that group:
>
> ```bash
> sudo usermod -aG audio $USER
> ```
>
> Log out and back in (or reboot) for the new group membership to take effect, then reopen Audio Settings.

3. Select the audio device connected to your radio under **Backend Input (Mic/Line)** (receive audio from the radio). Use the toggle switch next to the label to enable or disable this direction.
4. Select the audio device connected to your radio under **Backend Output (Speakers)** (transmit audio to the radio). Use its toggle switch to enable or disable it.
5. Click **Start Backend Audio** to start the audio engine. The status will change to **RUNNING**.
6. Click **Stop Backend Audio** to stop it.

> **Choosing the right device on Windows:** The device list shows the host API (MME, DirectSound, WASAPI) alongside the device name. For most radios, MME or DirectSound works reliably. If using WASAPI, the device must be configured to 48 kHz in Windows Sound settings — an incompatible WASAPI device will be shown as disabled in the list.

> **Enabling/Disabling directions:** You can run inbound-only (receive audio only) or outbound-only (transmit audio only) if your setup requires it. Use the Enabled toggles next to each device selector.

---

### Linux: Radio Power Cycling and USB Audio Reconnection

If your radio supports [remote power on/off](Controls#radio-power-onoff), powering it off can make its USB Audio interface disappear from the operating system entirely — not just go silent — if the audio interface shares the same USB device as the radio's CAT/serial control (this is the case on radios like the Yaesu FT-710). RigControl Web watches for the backend audio device to come back and automatically restarts the backend audio engine a couple of seconds after the radio reports it has powered back on.

On Linux systems running **PipeWire**, this reappearance is not always clean:

- The instant the radio's USB Audio device disappears, PipeWire re-targets its **default** ALSA/PulseAudio sink and source to whatever device is next available.
- When the radio's USB Audio device comes back online after power-on, PipeWire does **not** automatically switch its default back to it — the default stays pointed at whatever it fell back to.
- If your **Backend Input**/**Backend Output** selection in RigControl Web resolves through that system "default" device rather than a device pinned to the radio's specific hardware, backend audio into and out of RigControl Web will remain broken after every power cycle until the default is reassigned back to the radio.

**Workaround:** After powering the radio back on, check PipeWire's current default input/output (`wpctl status`, or a graphical mixer such as `pavucontrol` or `qpwgraph`) and reassign it to the radio's USB Audio device if it hasn't switched back on its own. Re-opening **Backend Audio Engine** settings and re-selecting the correct device (restarting backend audio if needed) also restores it for the current session.

#### FT-710: Required 44.1 kHz Virtual Device

The FT-710's USB Audio interface only operates correctly at a **44.1 kHz** sample rate. Selecting the radio's own PipeWire, ALSA, or PulseAudio device identifier directly still opens the device at 48 kHz and will not work, even though the identifier appears to point at the same hardware.

The supported setup on Linux/PipeWire is:

1. **Force PipeWire's global sample rate to 44.1 kHz.** Two ways to do this:

   - **Temporary (until reboot/PipeWire restart)** — run this once per session:

     ```bash
     pw-metadata -n settings 0 clock.force-rate 44100
     ```

   - **Permanent** — add a `clock.rate` override, for example a drop-in config file:

     ```
     # ~/.config/pipewire/pipewire.conf.d/44100-rate.conf
     context.properties = {
         default.clock.rate = 44100
     }
     ```

     then restart the user PipeWire services:

     ```bash
     systemctl --user restart pipewire pipewire-pulse wireplumber
     ```

     > Exact steps can vary by distribution — consult your distro's PipeWire documentation if this drop-in path doesn't apply to your setup.

2. In RigControl Web's **Audio Settings**, under **Backend Audio Engine**, select the device labeled **`pipewire [ALSA, 44.1k]`** for both **Backend Input** and **Backend Output** — not the FT-710's own hardware device entry. RigControl Web's device list shows the sample rate PipeWire reports at the time it enumerates devices in brackets after the host API name, so once the global rate is forced to 44.1 kHz this entry will read `44.1k`.

> Because this relies on PipeWire's default-device routing, the `pipewire [ALSA, 44.1k]` selection is subject to the same power-cycle caveat described above. After the radio powers off and back on, confirm this device is still selected and still resolves to the radio — PipeWire's default may have silently fallen back to another device in the meantime.

---

### Starting and Joining Audio

Once the backend audio engine is running, the **Join Audio** button appears in the **Audio Feed** panel header on the main screen.

- **Join Audio** — Connects your browser session to the running audio stream. You will hear received audio through your local output device, and your local microphone will be available for transmitting. You must join audio before the mute buttons or PTT audio will work.

If the backend audio engine is not started yet, you will not see the Join Audio button. Start the backend audio engine first (in Audio Settings), then join from the main screen.

---

### Mute Controls

Once you have joined audio, two mute buttons appear in the **Audio Feed** panel header:

- **Inbound mute** (headphone icon) — Mutes received audio so you do not hear it through your local speakers. The radio continues receiving; you just will not hear it.
- **Outbound mute** (microphone icon) — Mutes your microphone so your voice is not sent to the radio even if you key PTT.

---

### Local Speaker Volume

The **Local Speaker Volume** slider is found in Audio Settings under the Local Output (Speakers/Headphones) dropdown.

- **0%** — silence (equivalent to mute, but continuous rather than a toggle)
- **100%** — unity gain: audio plays at your system volume level with no modification
- **101–200%** — amplification beyond system volume; useful when your OS volume is already at maximum and the received audio is still too quiet

The slider adjusts volume in real time with no need to stop or restart audio. Your setting is saved in the browser and restored automatically on your next visit.

---

### Multi-Client Audio

Multiple people can connect to the same RigControl Web server at the same time, and all of them can hear received audio simultaneously. However, only one client at a time can transmit. If another client's microphone is active, a warning will appear in the audio settings. Unmuting your own microphone (or pressing PTT) will transfer the transmit session to you.

---

## Video Feed Panel

The **Video Feed** panel displays a live stream of your radio's front panel. A common setup is to connect your radio's DVI or HDMI output to a USB HDMI capture card plugged into your shack computer. The panel shows the stream when active and a "Stopped" placeholder when it is not.

The gear icon in the **Video Feed** panel header opens **Video Settings**.

---

## Opening Video Settings

Click the **gear icon** in the **Video Feed** panel header to open Video Settings.

---

## Video

Video lets you see your radio's front panel display on screen, which is especially useful when operating remotely.

![RigControl Web — Video Settings](https://raw.githubusercontent.com/jbdubbs/Rig-Control-Web/main/assets/rigcontrolweb.manual.video.settings.png)

### Setting Up Video

1. Open Video Settings (gear icon in the **Video Feed** panel header).
2. Under **Video Device**, select your capture device from the dropdown. If you do not see your device, make sure it is connected and recognized by your operating system.

> **Linux: device not listed?** On most Linux distributions, access to `/dev/video*` devices is restricted to users in the `video` group. If your capture card does not appear in the **Video Device** dropdown, add your user to that group:
>
> ```bash
> sudo usermod -aG video $USER
> ```
>
> Log out and back in (or reboot) for the new group membership to take effect, then reopen Video Settings.

3. Set the **Resolution** — width × height in pixels. Match this to what your capture card supports, or start with `640 × 480` and adjust if needed.
4. Choose a **Framerate**. Lower framerates (5–10 fps) use less bandwidth and are fine for watching a radio display. Higher framerates (24–30 fps) look smoother but use more resources.
5. Click **Start Video**. The feed will appear in the **Video Feed** panel on the main screen.
6. Click **Stop Video** to stop the feed.

The video feed is served from the server computer. Any client connected to RigControl Web will see the same video stream.
