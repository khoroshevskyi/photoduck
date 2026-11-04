// In-browser face landmark detection via MediaPipe FaceLandmarker.
// Returns chin/crown/eye geometry in SOURCE pixel coordinates, or null on failure.

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { DetectionResult } from '../types';
import { FACE_MODEL_PATH, WASM_PATH } from './mediapipeConfig';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_PATH },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
    })();
  }
  return landmarkerPromise;
}

export async function detectFace(image: HTMLImageElement): Promise<DetectionResult | null> {
  let landmarker: FaceLandmarker;
  try {
    landmarker = await getLandmarker();
  } catch (err) {
    console.warn('[faceDetection] model unavailable, manual mode:', err);
    landmarkerPromise = null;
    return null;
  }

  try {
    const result = landmarker.detect(image);
    const faces = result.faceLandmarks;
    if (!faces || faces.length === 0) return null;

    const pts = faces[0]; // normalized 0..1
    const W = image.naturalWidth;
    const H = image.naturalHeight;
    const px = (i: number) => ({ x: pts[i].x * W, y: pts[i].y * H });

    // MediaPipe FaceMesh canonical indices.
    const chin = px(152); // bottom of chin
    const foreheadTop = px(10); // top-center of forehead / hairline
    const leftEye = px(33); // left eye outer corner
    const rightEye = px(263); // right eye outer corner

    const eyeY = (leftEye.y + rightEye.y) / 2;
    const faceCenterX = (leftEye.x + rightEye.x) / 2;
    const tiltRad = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

    // The mesh stops at the forehead/hairline; estimate the true crown (incl. hair)
    // by extending above the forehead by a fraction of the face span.
    const faceSpan = chin.y - foreheadTop.y;
    const crownY = foreheadTop.y - 0.5 * faceSpan;

    // Expression / eyes from blendshapes (if the model emitted them).
    const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
    const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
    const hasShapes = shapes.length > 0;
    const blinkL = score('eyeBlinkLeft');
    const blinkR = score('eyeBlinkRight');
    const smile = Math.max(score('mouthSmileLeft'), score('mouthSmileRight'));
    const jawOpen = score('jawOpen');

    const eyesOpen = !hasShapes || (blinkL < 0.35 && blinkR < 0.35);
    const expressionNeutral = !hasShapes || (jawOpen < 0.3 && smile < 0.45);

    return { crownY, chinY: chin.y, faceCenterX, eyeY, tiltRad, confident: true, eyesOpen, expressionNeutral };
  } catch (err) {
    console.warn('[faceDetection] detect failed:', err);
    return null;
  }
}
