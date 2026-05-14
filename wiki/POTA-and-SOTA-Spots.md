# POTA, SOTA, and WWFF Spots

RigControl Web can display live activator spots for **Parks on the Air (POTA)**, **Summits on the Air (SOTA)**, and **World Wide Flora & Fauna (WWFF)**. Spots are pulled directly from the respective APIs and updated automatically. Clicking any spot instantly tunes your radio to that frequency and sets the correct mode — no manual dial twisting needed.

---

## Adding a Spots Panel

Spots panels are added to your layout like any other panel. Click the **Edit** button to enter layout edit mode, then click **Add Panel** and choose from:

- **POTA Spots** — Parks on the Air activators
- **SOTA Spots** — Summits on the Air activators
- **WWFF Spots** — World Wide Flora & Fauna activators
- **All Spots** — A combined panel showing POTA, SOTA, and WWFF together in a single tabbed view

Once a panel is placed in your layout, it begins fetching spots automatically. You can have individual panels for each service, the combined All Spots panel, or a mix of both.

---

## Settings

Each spots panel has a gear icon (⚙) in its header. Click it to open the settings for that panel. The **All Spots** panel's settings cover POTA, SOTA, and WWFF independently under separate tabs.

### Poll Frequency

How often the app fetches new spots from the API. Choose between 1 and 5 minutes. If you are actively hunting, a shorter interval keeps the list more current. For casual use, 3–5 minutes is fine and puts less load on the API.

### Max Spot Age

Spots older than this threshold are removed from the display. Options are 1, 3, 5, 10, or 15 minutes. Set this low (1–3 minutes) if you want only very fresh spots, or higher if you want a broader picture of activity on the bands.

### Band Filter

Limits the spot display to specific bands. Check the boxes for the bands you are interested in. Leave all boxes unchecked to show spots on all bands.

### Mode Filter

Narrows the display to a single mode: **SSB**, **CW**, **FT8**, **FT4**, or **All**. Select All to see spots regardless of mode.

Settings for POTA, SOTA, and WWFF are stored and applied independently — you can use different filters for each.

---

## Reading the Spots Table

Each spots panel shows a table with the following columns:

| Column | What it shows |
|--------|--------------|
| **Activator** | The callsign of the station on the air |
| **Frequency** | The frequency in MHz where they are operating |
| **Mode** | The operating mode (SSB, CW, FT8, etc.) |
| **Location** | The park, summit, or flora & fauna reference and name |
| **Age** | How long ago this spot was posted (e.g. "2m ago") |

Only the most recent spot per activator is shown — if the same callsign has been spotted multiple times, only the latest one appears.

---

## Sorting

Click any column header to sort by that column. Clicking the same header again reverses the sort direction. A third click returns to the default API order (most recent spot first). A small arrow in the header shows the current sort direction.

---

## Click-to-Tune

Click any row in the spots table to instantly tune your radio to that frequency and set the correct mode.

For SSB spots, the app automatically selects **USB** for frequencies above 10 MHz and **LSB** for frequencies at or below 10 MHz, following the standard band plan convention.

> You must be connected to your rig (green status dot in the header) for click-to-tune to work. If you are not connected, the spot rows are grayed out with a tooltip reminding you to connect first.

---

## Collapsing Panels

In all layouts you can collapse any spots panel by clicking the collapse arrow in the panel header to reclaim screen space when you are not actively hunting.
