// Canvas render pipeline shared by the live preview and the final export.
// Non-destructive: always renders from the original source + declarative state.

import type { Adjustments, CropTransform } from '../types';
import type { DocumentPreset } from '../presets/documentPresets';

export type ImageLike = CanvasImageSource & { width: number; height: number };

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

/** Composite a segmented subject over a solid background color. Returns a new canvas. */
export function compositeBackground(
  source: ImageLike,
  maskCanvas: HTMLCanvasElement,
  color: string,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;

  // Background fill.
  octx.fillStyle = color;
  octx.fillRect(0, 0, w, h);

  // Subject = source masked by alpha.
  const subject = document.createElement('canvas');
  subject.width = w;
  subject.height = h;
  const sctx = subject.getContext('2d')!;
  sctx.drawImage(source, 0, 0, w, h);
  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(maskCanvas, 0, 0, w, h);
  sctx.globalCompositeOperation = 'source-over';

  octx.drawImage(subject, 0, 0);
  return out;
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
