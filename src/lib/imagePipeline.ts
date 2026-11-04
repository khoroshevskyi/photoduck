// Canvas render pipeline shared by the live preview and the final export.
// Non-destructive: always renders from the original source + declarative state.

import type { Adjustments, CropTransform } from '../types';
import type { DocumentPreset } from '../presets/documentPresets';
import type { RawMask } from './segmentation';
import {
  DEFAULT_REFINE,
  decontaminateComposite,
  estimateBackgroundColor,
  hexToRgb,
  refineAlpha,
  toGrayscale01,
  type RefineOptions,
} from './maskRefine';

export type ImageLike = CanvasImageSource & { width: number; height: number };

/** Longest edge (px) of the grid the mask refinement runs on. Balances quality vs. speed. */
const REFINE_WORK_MAX = 1600;

/** Build a CSS filter string from the -100..100 adjustment sliders. */
export function filterString(adj: Adjustments): string {
  const brightness = 1 + (adj.brightness / 100) * 0.6 + (adj.exposure / 100) * 0.6;
  const contrast = 1 + (adj.contrast / 100) * 0.6;
  const saturate = 1 + (adj.saturation / 100) * 1.0;
  return `brightness(${clampF(brightness, 0.1, 3)}) contrast(${clampF(
    contrast,
    0.1,
    3,
  )}) saturate(${clampF(saturate, 0, 3)})`;
}

const clampF = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A gray canvas (R=G=B=alpha·255, A=255) so alpha can be bilinearly scaled by the browser. */
function alphaToCanvas(alpha: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const id = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(alpha[i] * 255)));
    const o = i * 4;
    id.data[o] = v;
    id.data[o + 1] = v;
    id.data[o + 2] = v;
    id.data[o + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return canvas;
}

/** Bilinearly resample a raw mask onto a `w×h` grid, returning alpha in [0,1]. */
function resampleRawMask(raw: RawMask, w: number, h: number): Float32Array {
  const src = alphaToCanvas(raw.data, raw.w, raw.h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, raw.w, raw.h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

/**
 * The expensive, color-independent part of background replacement: refine the
 * coarse mask against the source edges and produce a full-source-resolution
 * alpha matte plus an estimate of the old background color (for spill removal).
 * Cache this per image — recoloring only needs `compositeMatte`.
 */
export interface RefinedMatte {
  /** refined alpha in [0,1], row-major, length W*H (full source resolution) */
  alpha: Float32Array;
  /** estimated original background color (0..255), used to cancel edge spill */
  bgOld: [number, number, number];
  W: number;
  H: number;
}

export function refineMatte(
  source: ImageLike,
  raw: RawMask,
  opts: RefineOptions = DEFAULT_REFINE,
): RefinedMatte {
  const W = source.width;
  const H = source.height;
  const { roi } = raw;

  // 1. Working grid over the ROI (cap the longest edge for speed).
  const wScale = Math.min(1, REFINE_WORK_MAX / Math.max(roi.w, roi.h));
  const ww = Math.max(1, Math.round(roi.w * wScale));
  const wh = Math.max(1, Math.round(roi.h * wScale));

  // 2. Guide = source ROI at working resolution.
  const guideCanvas = document.createElement('canvas');
  guideCanvas.width = ww;
  guideCanvas.height = wh;
  const gctx = guideCanvas.getContext('2d', { willReadFrequently: true })!;
  gctx.drawImage(source, roi.x, roi.y, roi.w, roi.h, 0, 0, ww, wh);
  const guideRGBA = gctx.getImageData(0, 0, ww, wh).data;
  const guideGray = toGrayscale01(guideRGBA, ww * wh);

  // 3. Refine the coarse alpha against the guide edges.
  const rawAlpha = resampleRawMask(raw, ww, wh);
  const refined = refineAlpha(guideGray, rawAlpha, ww, wh, opts);

  // 4. Estimate the old background color from low-alpha guide pixels (spill removal).
  const bgOld = estimateBackgroundColor(guideRGBA, refined);

  // 5. Upscale refined alpha (working ROI → full source; zero outside the ROI).
  const alphaCanvas = alphaToCanvas(refined, ww, wh);
  const fullAlpha = document.createElement('canvas');
  fullAlpha.width = W;
  fullAlpha.height = H;
  const factx = fullAlpha.getContext('2d', { willReadFrequently: true })!;
  factx.imageSmoothingQuality = 'high';
  factx.fillStyle = '#000000'; // alpha 0 ⇒ pure background outside the ROI
  factx.fillRect(0, 0, W, H);
  factx.drawImage(alphaCanvas, 0, 0, ww, wh, roi.x, roi.y, roi.w, roi.h);
  const alphaRGBA = factx.getImageData(0, 0, W, H).data;
  const n = W * H;
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = alphaRGBA[i * 4] / 255;

  return { alpha, bgOld, W, H };
}

/**
 * The cheap, color-dependent part: lay the matted subject over a solid color,
 * cancelling the old background spill. Returns a full-source-size canvas (so the
 * editor transform maps it exactly like the original source).
 */
export function compositeMatte(
  source: ImageLike,
  matte: RefinedMatte,
  color: string,
): HTMLCanvasElement {
  const { alpha, bgOld, W, H } = matte;

  // Full-resolution source pixels (keeps interior detail at native quality).
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = W;
  srcCanvas.height = H;
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(source, 0, 0);
  const srcRGBA = sctx.getImageData(0, 0, W, H).data;

  const outData = decontaminateComposite(srcRGBA, alpha, bgOld, hexToRgb(color), W * H);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  out.getContext('2d')!.putImageData(new ImageData(outData, W, H), 0, 0);
  return out;
}

/**
 * Convenience: refine + composite in one call. Returns a new full-source-size
 * canvas with the subject over a solid color.
 */
export function compositeBackground(
  source: ImageLike,
  raw: RawMask,
  color: string,
  opts: RefineOptions = DEFAULT_REFINE,
): HTMLCanvasElement {
  return compositeMatte(source, refineMatte(source, raw, opts), color);
}

export interface RenderArgs {
  source: ImageLike;
  transform: CropTransform;
  preset: DocumentPreset;
  adjustments: Adjustments;
  /** output height in px; width derived from the preset aspect ratio. Defaults to full print height. */
  outHeight?: number;
  /** fill behind the image (shown if rotation/zoom exposes corners) */
  matteColor?: string;
}

export function outputWidthFor(preset: DocumentPreset, outHeight: number): number {
  return Math.round((outHeight * preset.outputPx.w) / preset.outputPx.h);
}

/** Render the composed photo into the given canvas. */
export function renderToCanvas(canvas: HTMLCanvasElement, args: RenderArgs): void {
  const { source, transform, preset, adjustments } = args;
  const outH = args.outHeight ?? preset.outputPx.h;
  const outW = outputWidthFor(preset, outH);
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  // Matte (visible only where the image doesn't cover the frame).
  ctx.fillStyle = args.matteColor ?? '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  const ds = outH / preset.outputPx.h; // screen px per output px

  ctx.save();
  ctx.filter = filterString(adjustments);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(transform.rotation);
  ctx.scale(ds / transform.scale, ds / transform.scale);
  ctx.translate(-transform.cx, -transform.cy);
  ctx.drawImage(source, 0, 0);
  ctx.restore();

  // Temperature as a soft-light tint overlay (not expressible via CSS filter).
  if (adjustments.temperature !== 0) {
    const t = adjustments.temperature / 100;
    const warm = t > 0;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(0.5, Math.abs(t) * 0.55);
    ctx.fillStyle = warm ? 'rgb(255,140,40)' : 'rgb(40,130,255)';
    ctx.fillRect(0, 0, outW, outH);
    ctx.restore();
  }
}

/** Convenience: render to a fresh canvas. */
export function renderOutput(args: RenderArgs): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  renderToCanvas(canvas, args);
  return canvas;
}
