type ColorStop = [t: number, r: number, g: number, b: number];

function buildColorMap(stops: ColorStop[]): Uint32Array {
  const map = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        lo = stops[s];
        hi = stops[s + 1];
        break;
      }
    }
    const alpha = hi[0] > lo[0] ? (t - lo[0]) / (hi[0] - lo[0]) : 0;
    const r = Math.round(lo[1] + (hi[1] - lo[1]) * alpha);
    const g = Math.round(lo[2] + (hi[2] - lo[2]) * alpha);
    const b = Math.round(lo[3] + (hi[3] - lo[3]) * alpha);
    // Pack as little-endian RGBA for ImageData (R, G, B, A byte order)
    map[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return map;
}

// Classic SDR: black → blue → cyan → yellow → red → white
export const COLORMAP_CLASSIC = buildColorMap([
  [0,    0,   0,   0],
  [0.2,  0,   0,   180],
  [0.4,  0,   180, 180],
  [0.6,  180, 180, 0],
  [0.8,  180, 0,   0],
  [1.0,  255, 255, 255],
]);

// Grayscale: black → white
export const COLORMAP_GRAYSCALE = buildColorMap([
  [0,   0,   0,   0],
  [1.0, 255, 255, 255],
]);

// Heat/Inferno: black → purple → red → orange → yellow → white
export const COLORMAP_HEAT = buildColorMap([
  [0,    0,   0,   0],
  [0.25, 80,  0,   120],
  [0.5,  180, 0,   0],
  [0.75, 255, 140, 0],
  [1.0,  255, 255, 200],
]);

export const COLORMAPS: Record<string, Uint32Array> = {
  classic: COLORMAP_CLASSIC,
  grayscale: COLORMAP_GRAYSCALE,
  heat: COLORMAP_HEAT,
};

export const COLORMAP_NAMES = [
  { id: "classic", label: "Classic" },
  { id: "grayscale", label: "Grayscale" },
  { id: "heat", label: "Heat" },
];

export function amplitudeToPixel(
  amplitude: number,
  floor: number,
  ceiling: number,
  colorMap: Uint32Array,
): number {
  const clamped = Math.max(floor, Math.min(ceiling, amplitude));
  const normalized = Math.round(((clamped - floor) / (ceiling - floor)) * 255);
  return colorMap[normalized];
}
