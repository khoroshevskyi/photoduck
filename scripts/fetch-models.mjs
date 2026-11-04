// Fetch & self-host MediaPipe assets so the app runs fully offline and no user
// data ever leaves the browser. Run: `npm run setup:models`.

import { cp, mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = join(publicDir, 'mediapipe', 'wasm');
const modelsDir = join(publicDir, 'models');

const MODELS = [
  {
    name: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    name: 'selfie_segmenter.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  },
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // 1. Copy wasm runtime from the installed package.
  if (await exists(wasmSrc)) {
    await mkdir(wasmDest, { recursive: true });
    await cp(wasmSrc, wasmDest, { recursive: true });
    console.log('✓ copied MediaPipe wasm →', wasmDest);
  } else {
    console.warn('! wasm source not found at', wasmSrc, '(did npm install run?)');
  }

  // 2. Download model files.
  await mkdir(modelsDir, { recursive: true });
  for (const m of MODELS) {
    const dest = join(modelsDir, m.name);
    if (await exists(dest)) {
      console.log('· already present', m.name);
      continue;
    }
    process.stdout.write(`↓ ${m.name} … `);
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`${m.name}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
  }
  console.log('\nDone. Models self-hosted under public/.');
}

main().catch((err) => {
  console.error('\nModel setup failed:', err.message);
  process.exit(1);
});
