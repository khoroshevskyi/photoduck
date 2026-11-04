// Background analysis: sample the top corners of the composed photo (reliably
// background for a centered head) and judge uniformity + color. No ML model.

import type { BackgroundCheckSpec, BackgroundReplacementPolicy } from '../presets/documentPresets';
import type { CheckStatus } from './compliance';

export interface BackgroundStats {
  meanColor: [number, number, number];
  /** std-dev of luminance across sampled pixels (0-255) */
  variation: number;
  /** color distance between the two top corners (0-255) — catches gradients */
  cornerDiff: number;
  /** mean luminance (0-255) */
  luminance: number;
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

interface Patch {
  r: number;
  g: number;
  b: number;
  n: number;
}

function samplePatch(data: Uint8ClampedArray): Patch {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return { r: r / n, g: g / n, b: b / n, n };
}

/** Analyze a rendered output canvas. Returns null if it can't be read. */
export function analyzeBackground(canvas: HTMLCanvasElement): BackgroundStats | null {
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width < 8 || canvas.height < 8) return null;

  const W = canvas.width;
  const H = canvas.height;
  const bw = Math.max(4, Math.round(W * 0.18));
  const bh = Math.max(4, Math.round(H * 0.28));
  const y0 = Math.round(H * 0.02);

  let left: ImageData;
  let right: ImageData;
  try {
    left = ctx.getImageData(0, y0, bw, bh);
    right = ctx.getImageData(W - bw, y0, bw, bh);
  } catch {
    return null; // tainted canvas, etc.
  }

  const lp = samplePatch(left.data);
  const rp = samplePatch(right.data);
  const meanColor: [number, number, number] = [(lp.r + rp.r) / 2, (lp.g + rp.g) / 2, (lp.b + rp.b) / 2];

  // Luminance spread across all sampled pixels.
  let sum = 0;
  let sum2 = 0;
  let count = 0;
  for (const d of [left.data, right.data]) {
    for (let i = 0; i < d.length; i += 4) {
      const l = lum(d[i], d[i + 1], d[i + 2]);
      sum += l;
      sum2 += l * l;
      count++;
    }
  }
  const meanLum = sum / count;
  const variation = Math.sqrt(Math.max(0, sum2 / count - meanLum * meanLum));
  const cornerDiff = (Math.abs(lp.r - rp.r) + Math.abs(lp.g - rp.g) + Math.abs(lp.b - rp.b)) / 3;

  return { meanColor, variation, cornerDiff, luminance: meanLum };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export interface BackgroundVerdict {
  status: CheckStatus;
  detail: string;
}

/** Pure judgment of background stats against a format's requirements. */
export function evaluateBackgroundStats(
  stats: BackgroundStats | null,
  spec: BackgroundCheckSpec,
  replaced: boolean,
  policy: BackgroundReplacementPolicy,
): BackgroundVerdict {
  if (replaced) {
    if (policy === 'prohibited') {
      return { status: 'fail', detail: 'Digitally replaced background — not accepted for this document.' };
    }
    return { status: 'warn', detail: 'Background replaced — only use this if your authority allows it.' };
  }

  if (!stats) return { status: 'info', detail: `Use a ${spec.label} background.` };

  if (stats.variation > spec.uniformityDelta || stats.cornerDiff > spec.uniformityDelta * 1.5) {
    return { status: 'warn', detail: `Background looks uneven — use a ${spec.label} background.` };
  }
  if (stats.luminance < 150) {
    return { status: 'warn', detail: `Background is too dark — use a ${spec.label} background.` };
  }
  if (spec.targetColor) {
    const target = hexToRgb(spec.targetColor);
    const diff =
      (Math.abs(stats.meanColor[0] - target[0]) +
        Math.abs(stats.meanColor[1] - target[1]) +
        Math.abs(stats.meanColor[2] - target[2])) /
      3;
    if (diff > spec.colorToleranceDelta) {
      return { status: 'warn', detail: `Background should be ${spec.label}.` };
    }
  }
  return { status: 'pass', detail: `Looks like a ${spec.label} background.` };
}
