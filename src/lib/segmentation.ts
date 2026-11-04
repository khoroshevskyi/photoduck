// In-browser person segmentation via MediaPipe ImageSegmenter (selfie model).
// Returns an alpha mask canvas (alpha = subject probability) or null on failure.

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { SEGMENTER_MODEL_PATH, WASM_PATH } from './mediapipeConfig';

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SEGMENTER_MODEL_PATH },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    })();
  }
  return segmenterPromise;
}

/** Returns a canvas whose alpha channel encodes subject (person) coverage, or null. */
export async function segmentPerson(image: HTMLImageElement): Promise<HTMLCanvasElement | null> {
  let segmenter: ImageSegmenter;
  try {
    segmenter = await getSegmenter();
  } catch (err) {
    console.warn('[segmentation] model unavailable:', err);
    segmenterPromise = null;
    return null;
  }

  try {
    const result = segmenter.segment(image);
    const mask = result.confidenceMasks?.[0];
    if (!mask) {
      result.close();
      return null;
    }
    const w = mask.width;
    const h = mask.height;
    const floats = mask.getAsFloat32Array();

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const a = Math.max(0, Math.min(1, floats[i]));
      imageData.data[i * 4 + 0] = 255;
      imageData.data[i * 4 + 1] = 255;
      imageData.data[i * 4 + 2] = 255;
      imageData.data[i * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(imageData, 0, 0);
    result.close();

    // Light feather to avoid hard cut-out edges.
    const feathered = document.createElement('canvas');
    feathered.width = w;
    feathered.height = h;
    const fctx = feathered.getContext('2d')!;
    fctx.filter = 'blur(1.2px)';
    fctx.drawImage(canvas, 0, 0);
    return feathered;
  } catch (err) {
    console.warn('[segmentation] segment failed:', err);
    return null;
  }
}
