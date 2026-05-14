# Solar and Propagation

RigControl Web includes two propagation tools you can add to your layout: the **Solar** panel, which displays live HF and VHF band conditions alongside detailed solar indices, and the **MUF Map** panel, which shows a zoomable world map of Maximum Usable Frequency or F2 critical frequency data.

Both panels require an internet connection on the server computer.

---

## Solar Panel

### Adding the Panel

Click **Edit** to enter layout edit mode, then click **Add Panel** and select **Solar**. No further configuration is required — data is fetched automatically by the server.

### Data Source and Refresh

Solar data is fetched from [hamqsl.com](https://www.hamqsl.com/) (courtesy of N0NBH). The server caches the data for one hour, so all connected clients share the same fetch. eSFI and eSSN estimated values are supplemented from [prop.kc2g.com](https://prop.kc2g.com/) (KC2G/WWROF/GIRO) when available.

A **manual refresh button** and the data timestamp are shown at the bottom of the panel. Click the refresh icon to force an immediate update.

### HF Tab

The default tab. Shows:

- **Quick-glance indices** at the top: Solar Flux Index (SFI), Sunspot Number (SN), A-index, and K-index. Values are color-coded — green is favorable, amber is moderate, red is poor.
- **HF band conditions table** with Day and Night columns for four band groups: 80m–40m, 30m–20m, 17m–15m, and 12m–10m. Each entry shows **Good**, **Fair**, or **Poor** in the corresponding color.

### VHF Tab

Shows VHF propagation conditions broken out by region and phenomenon:

| Column | What it shows |
|--------|--------------|
| **Type** | Propagation mode (Aurora, Sporadic-E, Transequatorial, Troposcatter, Meteor Scatter, etc.) |
| **Location** | Region (N. Hemisphere, N. America, Europe, Europe 6m, Europe 4m) |
| **Status** | Band Open (green) or Band Closed (red) |

### SOLAR/GEO Tab

Full detail on solar and geomagnetic conditions:

**Solar indices:**

| Field | Meaning |
|-------|---------|
| SFI | Solar Flux Index — higher is better for HF propagation (≥150 excellent, ≥120 good) |
| SN | Sunspot Number |
| eSFI | Estimated SFI from real-time ionospheric data (prop.kc2g.com) |
| eSSN | Estimated Sunspot Number from real-time ionospheric data |

eSFI and eSSN only appear when prop.kc2g.com data is available.

**Geomagnetic and noise:**

| Field | Meaning |
|-------|---------|
| A | A-index — daily geomagnetic activity (<20 quiet, 20–29 unsettled, 30–49 active, ≥50 storm) |
| K | K-index — 3-hour geomagnetic activity (<4 quiet, 4 unsettled, ≥5 storm) |
| Geomag | Text description of geomagnetic field (Quiet, Unsettled, Active, Storm) |
| XRay | X-ray flux class (A/B/C/M/X) |
| Noise | Signal noise level description |

---

## MUF Map Panel

### Adding the Panel

Click **Edit** to enter layout edit mode, then click **Add Panel** and select **MUF Map**. A height slider appears in the panel picker before you confirm — choose how tall you want the map panel to be. Height is set at add-time and can be changed by removing and re-adding the panel.

### What the Map Shows

The map is a live SVG world propagation map from [prop.kc2g.com](https://prop.kc2g.com/) (KC2G/WWROF/GIRO).

Two metrics are available via the buttons in the panel header:

| Metric | Description |
|--------|-------------|
| **MUFD** | Maximum Usable Frequency for a 3000 km path. Shows the highest frequency likely to support F2 propagation between two points ~3000 km apart. |
| **foF2** | F2 layer critical frequency. The highest frequency reflected vertically by the F2 ionospheric layer directly overhead. Lower than MUFD. |

### Time Slots

The four time slot buttons let you compare current conditions to recent history:

| Button | Shows |
|--------|-------|
| **Now** | Current conditions |
| **−1h** | Conditions one hour ago |
| **−12h** | Conditions twelve hours ago |
| **−24h** | Conditions twenty-four hours ago |

### Navigating the Map

- **Scroll** — Zoom in or out, centered on the cursor position.
- **Click and drag** — Pan the map when zoomed in.
- **Pinch** — Zoom on touch screens.
- **Double-click** — Reset zoom to 1×. Also click the zoom percentage badge in the header to reset.

The panel header shows the current zoom percentage when zoomed in. Switching the metric or time slot automatically resets the zoom.

### Auto-Refresh

The map reloads automatically every **10 minutes**. Click the refresh icon in the panel header to force an immediate reload.
