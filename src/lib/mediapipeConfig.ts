// Paths to the self-hosted MediaPipe assets (run `npm run setup:models` to fetch them).
// Kept local so the app can run fully offline and no user data ever leaves the browser.
// If a file is missing, detection/segmentation degrade gracefully to manual mode.

const base = import.meta.env.BASE_URL;

export const WASM_PATH = `${base}mediapipe/wasm`;
export const FACE_MODEL_PATH = `${base}models/face_landmarker.task`;
export const SEGMENTER_MODEL_PATH = `${base}models/selfie_segmenter.tflite`;
