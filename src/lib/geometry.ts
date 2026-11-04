// Pure geometry: maps the source image into the fixed 35:45 output frame,
// and computes head-size compliance. All functions here are side-effect free
// and unit-testable.

import type { CropTransform, DetectionResult, GuideLines, Vec2 } from '../types';
import type { DocumentPreset } from '../presets/documentPresets';

/**
 * Forward map: a point in SOURCE pixels -> OUTPUT frame pixels (0..outW, 0..outH).
 * Inverse of the canvas draw transform used by the render pipeline.
 */
export function sourceToOutput(
  pt: Vec2,
  t: CropTransform,
  out: { w: number; h: number },
): Vec2 {
  // translate by -(cx,cy), scale by 1/scale, rotate by +rotation, translate to center
  let x = pt.x - t.cx;
  let y = pt.y - t.cy;
  x /= t.scale;
  y /= t.scale;
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  return { x: rx + out.w / 2, y: ry + out.h / 2 };
}

/** Inverse map: OUTPUT frame pixels -> SOURCE pixels. */
export function outputToSource(
  pt: Vec2,
  t: CropTransform,
  out: { w: number; h: number },
): Vec2 {
  let x = pt.x - out.w / 2;
  let y = pt.y - out.h / 2;
  const cos = Math.cos(-t.rotation);
  const sin = Math.sin(-t.rotation);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  x = rx * t.scale + t.cx;
  y = ry * t.scale + t.cy;
  return { x, y };
}

/** Head height (chin->crown) in mm, given detected source points and the current transform. */
export function detectedHeadMm(
  detection: DetectionResult,
  t: CropTransform,
  preset: DocumentPreset,
): number {
  const crown = sourceToOutput({ x: detection.faceCenterX, y: detection.crownY }, t, preset.outputPx);
  const chin = sourceToOutput({ x: detection.faceCenterX, y: detection.chinY }, t, preset.outputPx);
  const headPx = Math.abs(chin.y - crown.y);
  return (headPx / preset.outputPx.h) * preset.photoMm.h;
}

/** Where the detected crown/chin currently sit, as fractions of frame height. */
export function detectedFracs(
  detection: DetectionResult,
  t: CropTransform,
  preset: DocumentPreset,
): { crownFrac: number; chinFrac: number; eyeFrac: number; centerFrac: number } {
  const crown = sourceToOutput({ x: detection.faceCenterX, y: detection.crownY }, t, preset.outputPx);
  const chin = sourceToOutput({ x: detection.faceCenterX, y: detection.chinY }, t, preset.outputPx);
  const eye = sourceToOutput({ x: detection.faceCenterX, y: detection.eyeY }, t, preset.outputPx);
  return {
    crownFrac: crown.y / preset.outputPx.h,
    chinFrac: chin.y / preset.outputPx.h,
    eyeFrac: eye.y / preset.outputPx.h,
    centerFrac: crown.x / preset.outputPx.w,
  };
}

/** Default guide line positions (fractions of frame height) for a preset. */
export function defaultGuides(preset: DocumentPreset): GuideLines {
  const crownFrac = preset.crownTopMarginMm / preset.photoMm.h;
  const chinFrac = (preset.crownTopMarginMm + preset.faceHeightMm.target) / preset.photoMm.h;
  return { crownFrac, chinFrac };
}

/** mm between two guide-line fractions. */
export function guideHeadMm(guides: GuideLines, preset: DocumentPreset): number {
  return (guides.chinFrac - guides.crownFrac) * preset.photoMm.h;
}

/**
 * Compute a crop transform that places a detected face at the compliant target:
 * head = target mm, crown at the default top-margin line, horizontally centered.
 */
export function autoFitTransform(
  detection: DetectionResult,
  preset: DocumentPreset,
  rotation = 0,
): CropTransform {
  const { outputPx, photoMm, faceHeightMm, crownTopMarginMm } = preset;
  const headSourcePx = Math.abs(detection.chinY - detection.crownY);
  const targetHeadOutputPx = (faceHeightMm.target / photoMm.h) * outputPx.h;
  const scale = headSourcePx / targetHeadOutputPx; // source px per output px

  // We want crownY (source) to map to crownOutputY (output).
  const crownOutputY = (crownTopMarginMm / photoMm.h) * outputPx.h;
  // From sourceToOutput (rotation≈0 for vertical placement): outY = (sourceY-cy)/scale + H/2
  const cy = detection.crownY - (crownOutputY - outputPx.h / 2) * scale;
  const cx = detection.faceCenterX;
  return { scale, cx, cy, rotation };
}

/**
 * Export height (px) that samples the source 1:1 — the true maximum quality with
 * no upscaling. `transform.scale` = source px per 300-DPI output px, so
 * outputPx.h × scale = the real source pixels spanning the crop. Capped generously
 * (~1200 DPI) to avoid pathologically huge files; never floored (we don't fake detail).
 */
export function nativeExportHeight(preset: DocumentPreset, t: CropTransform): number {
  const native = Math.round(preset.outputPx.h * t.scale);
  const cap = preset.outputPx.h * 4;
  return Math.min(cap, Math.max(1, native));
}

/** Effective print DPI for an export of the given pixel height. */
export function effectiveDpi(preset: DocumentPreset, heightPx: number): number {
  return Math.round((heightPx / preset.photoMm.h) * 25.4);
}

/** Clamp helper. */
export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const radToDeg = (r: number): number => (r * 180) / Math.PI;
export const degToRad = (d: number): number => (d * Math.PI) / 180;
