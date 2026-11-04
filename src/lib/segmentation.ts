// In-browser person segmentation via MediaPipe ImageSegmenter (selfie model).
//
// The selfie model emits a coarse (~256px) confidence mask regardless of input
// size, so running it on a whole full-body frame spends that tiny budget mostly
// on empty background. Instead we segment a padded ROI around the detected head
// & shoulders, concentrating the model's resolution where the subject is. We
// return the RAW probability field (no stretching, no feather) + the ROI it
// covers; imagePipeline.ts refines and composites it (see maskRefine.ts).

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import type { DetectionResult, Size } from '../types';
import { SEGMENTER_MODEL_PATH, WASM_PATH } from './mediapipeConfig';

/** Longest edge (px) of the canvas fed to the segmenter. The model is ~256px internally. */
const SEG_INPUT_MAX = 1024;

export interface Roi {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Raw subject-probability field over a region of the source image. */
export interface RawMask {
  /** subject probability in [0,1], row-major, length w*h */
  data: Float32Array;
  w: number;
  h: number;
  /** source-pixel region this field covers; outside it the subject is assumed absent */
  roi: Roi;
}

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return ImageSegmenter.createFromOptions(fileset, {
        // CPU delegate for the same reason as face detection: works without WebGL.
        baseOptions: { modelAssetPath: SEGMENTER_MODEL_PATH, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    })();
  }
  return segmenterPromise;
}

/**
 * A generous head-&-shoulders ROI (source px) from the detected face. Wide enough
 * for shoulders, extended to the image bottom (the body never ends above frame),
 * and padded above the crown for hair. Falls back to the full frame without a
 * confident detection.
 */
export function computePersonRoi(detection: DetectionResult | null, size: Size): Roi {
  const full: Roi = { x: 0, y: 0, w: size.w, h: size.h };
  if (!detection || !detection.confident) return full;

  const headPx = Math.abs(detection.chinY - detection.crownY);
  if (!(headPx > 0)) return full;

  const halfW = headPx * 2.5; // ~5× head width total — comfortably covers shoulders
  const top = detection.crownY - headPx * 0.7; // hair above the detected crown
  const left = detection.faceCenterX - halfW;
  const right = detection.faceCenterX + halfW;

  const x = Math.max(0, Math.floor(left));
  const y = Math.max(0, Math.floor(top));
  const x2 = Math.min(size.w, Math.ceil(right));
  const y2 = size.h; // extend to the bottom edge
  const w = Math.max(1, x2 - x);
  const h = Math.max(1, y2 - y);
  return { x, y, w, h };
}

/**
 * Segment the person within `roi` (defaults to the whole image). Returns the raw
 * probability field + the ROI, or null if the model is unavailable.
 */
export async function segmentPerson(
  image: HTMLImageElement,
  roi?: Roi,
): Promise<RawMask | null> {
  let segmenter: ImageSegmenter;
  try {
    segmenter = await getSegmenter();
  } catch (err) {
    console.warn('[segmentation] model unavailable:', err);
    segmenterPromise = null;
    return null;
  }

  const region: Roi = roi ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };

  // Draw the ROI into an input canvas, capped so the segmenter stays fast.
  const inScale = Math.min(1, SEG_INPUT_MAX / Math.max(region.w, region.h));
  const sw = Math.max(1, Math.round(region.w * inScale));
  const sh = Math.max(1, Math.round(region.h * inScale));
  const input = document.createElement('canvas');
  input.width = sw;
  input.height = sh;
  const ictx = input.getContext('2d')!;
  ictx.drawImage(image, region.x, region.y, region.w, region.h, 0, 0, sw, sh);

  try {
    const result = segmenter.segment(input);
    const mask = result.confidenceMasks?.[0];
    if (!mask) {
      result.close();
      return null;
    }
    const w = mask.width;
    const h = mask.height;
    const data = new Float32Array(mask.getAsFloat32Array()); // copy — view dies on close()
    result.close();
    return { data, w, h, roi: region };
  } catch (err) {
    console.warn('[segmentation] segment failed:', err);
    return null;
  }
}
