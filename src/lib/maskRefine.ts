// Edge-aware refinement of a coarse segmentation mask + background spill removal.
//
// Everything here is PURE and DOM-free: it operates on plain typed arrays so it
// can be unit-tested headlessly (see scripts/verify-mask.ts). The canvas glue
// (reading/scaling pixels) lives in imagePipeline.ts / segmentation.ts.
//
// The coarse person mask from MediaPipe carries only ~256px of real boundary
// information, bilinearly smeared to full size — soft, imprecise edges. A
// guided filter re-aligns that soft alpha to the real image edges (the source
// grayscale is the "guide"), connected-component cleanup drops stray blobs and
// fills holes, and decontamination removes the old background color that bleeds
// through semi-transparent edge pixels (the classic halo).

export interface RefineOptions {
  /** guided-filter window radius (px, at working resolution) */
  guidedRadius: number;
  /** guided-filter regularization; smaller = sharper/snappier, larger = smoother */
  eps: number;
  /** contrast gain applied around α=0.5 to steepen the (now edge-aligned) transition; 1 = off */
  edgeGain: number;
  /** grow the kept-component mask by this radius before gating (keeps the feather) */
  dilateRadius: number;
  /** final feather radius (px); 0 disables */
  featherRadius: number;
  /** alpha threshold that defines the solid "core" for component/hole analysis */
  coreThresh: number;
}

export const DEFAULT_REFINE: RefineOptions = {
  guidedRadius: 6,
  eps: 1e-4,
  edgeGain: 2.5,
  dilateRadius: 9,
  featherRadius: 1,
  coreThresh: 0.5,
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Mean (box) filter via an integral image. O(n) regardless of radius; borders use the actual window area. */
export function boxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const iw = w + 1;
  const integ = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const row = y * w;
    const below = (y + 1) * iw;
    const above = y * iw;
    for (let x = 0; x < w; x++) {
      rowSum += src[row + x];
      integ[below + (x + 1)] = integ[above + (x + 1)] + rowSum;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    const t0 = y0 * iw;
    const t1 = (y1 + 1) * iw;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const sum = integ[t1 + (x1 + 1)] - integ[t0 + (x1 + 1)] - integ[t1 + x0] + integ[t0 + x0];
      const cnt = (y1 - y0 + 1) * (x1 - x0 + 1);
      out[y * w + x] = sum / cnt;
    }
  }
  return out;
}

/**
 * Guided filter (He et al.). Transfers edges from the guide `I` into the input
 * `p`, so a soft alpha ramp snaps to real image boundaries. All inputs in [0,1].
 */
export function guidedFilter(
  I: Float32Array,
  p: Float32Array,
  w: number,
  h: number,
  r: number,
  eps: number,
): Float32Array {
  const n = w * h;
  const meanI = boxFilter(I, w, h, r);
  const meanP = boxFilter(p, w, h, r);
  const II = new Float32Array(n);
  const IP = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    II[i] = I[i] * I[i];
    IP[i] = I[i] * p[i];
  }
  const corrI = boxFilter(II, w, h, r);
  const corrIP = boxFilter(IP, w, h, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const covIP = corrIP[i] - meanI[i] * meanP[i];
    a[i] = covIP / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxFilter(a, w, h, r);
  const meanB = boxFilter(b, w, h, r);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = meanA[i] * I[i] + meanB[i];
  return q;
}

/**
 * Keep only the largest connected foreground component (4-connectivity) and fill
 * interior holes. Returns a binary 0/1 mask. If nothing clears the threshold the
 * result is all-ones (a no-op gate) rather than nuking the mask.
 */
export function keepLargestAndFill(
  alpha: Float32Array,
  w: number,
  h: number,
  thresh: number,
): Uint8Array {
  const n = w * h;
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = alpha[i] >= thresh ? 1 : 0;

  const label = new Int32Array(n); // 0 = unlabeled
  const stack = new Int32Array(n);
  let cur = 0;
  let best = 0;
  let bestSize = 0;

  for (let s = 0; s < n; s++) {
    if (bin[s] === 0 || label[s] !== 0) continue;
    cur++;
    let sp = 0;
    stack[sp++] = s;
    label[s] = cur;
    let size = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      size++;
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x > 0) {
        const ni = idx - 1;
        if (bin[ni] && label[ni] === 0) { label[ni] = cur; stack[sp++] = ni; }
      }
      if (x < w - 1) {
        const ni = idx + 1;
        if (bin[ni] && label[ni] === 0) { label[ni] = cur; stack[sp++] = ni; }
      }
      if (y > 0) {
        const ni = idx - w;
        if (bin[ni] && label[ni] === 0) { label[ni] = cur; stack[sp++] = ni; }
      }
      if (y < h - 1) {
        const ni = idx + w;
        if (bin[ni] && label[ni] === 0) { label[ni] = cur; stack[sp++] = ni; }
      }
    }
    if (size > bestSize) { bestSize = size; best = cur; }
  }

  const keep = new Uint8Array(n);
  if (bestSize === 0) {
    keep.fill(1);
    return keep;
  }
  for (let i = 0; i < n; i++) keep[i] = label[i] === best ? 1 : 0;

  // Fill holes: flood the background (keep==0) inward from the borders; any
  // unreached background pixel is enclosed by the subject -> a hole -> fill it.
  const reached = new Uint8Array(n);
  let sp = 0;
  for (let x = 0; x < w; x++) {
    const top = x;
    const bot = (h - 1) * w + x;
    if (keep[top] === 0 && !reached[top]) { reached[top] = 1; stack[sp++] = top; }
    if (keep[bot] === 0 && !reached[bot]) { reached[bot] = 1; stack[sp++] = bot; }
  }
  for (let y = 0; y < h; y++) {
    const left = y * w;
    const right = y * w + (w - 1);
    if (keep[left] === 0 && !reached[left]) { reached[left] = 1; stack[sp++] = left; }
    if (keep[right] === 0 && !reached[right]) { reached[right] = 1; stack[sp++] = right; }
  }
  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) { const ni = idx - 1; if (keep[ni] === 0 && !reached[ni]) { reached[ni] = 1; stack[sp++] = ni; } }
    if (x < w - 1) { const ni = idx + 1; if (keep[ni] === 0 && !reached[ni]) { reached[ni] = 1; stack[sp++] = ni; } }
    if (y > 0) { const ni = idx - w; if (keep[ni] === 0 && !reached[ni]) { reached[ni] = 1; stack[sp++] = ni; } }
    if (y < h - 1) { const ni = idx + w; if (keep[ni] === 0 && !reached[ni]) { reached[ni] = 1; stack[sp++] = ni; } }
  }
  for (let i = 0; i < n; i++) if (keep[i] === 0 && reached[i] === 0) keep[i] = 1;
  return keep;
}

/** Dilate a binary mask by `r` (box neighbourhood) using the box-filter > 0 trick. */
export function dilate(bin: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const n = w * h;
  const f = new Float32Array(n);
  for (let i = 0; i < n; i++) f[i] = bin[i];
  const sm = boxFilter(f, w, h, r);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = sm[i] > 0 ? 1 : 0;
  return out;
}

/**
 * Full refinement: guided-filter the coarse alpha against the source grayscale,
 * gate it to the (dilated) largest component with holes filled, and feather.
 * `guideGray01` and `rawAlpha01` are [0,1], length w*h. Returns refined [0,1] alpha.
 */
export function refineAlpha(
  guideGray01: Float32Array,
  rawAlpha01: Float32Array,
  w: number,
  h: number,
  opts: RefineOptions = DEFAULT_REFINE,
): Float32Array {
  let q = guidedFilter(guideGray01, rawAlpha01, w, h, opts.guidedRadius, opts.eps);
  // The guided filter has re-aligned the soft edge to the true image boundary but
  // only partially sharpened it; steepen the contrast around 0.5 to crisp it up.
  const g = opts.edgeGain;
  for (let i = 0; i < q.length; i++) {
    q[i] = g !== 1 ? clamp01(0.5 + (q[i] - 0.5) * g) : clamp01(q[i]);
  }

  const keep = keepLargestAndFill(q, w, h, opts.coreThresh);
  const gate = opts.dilateRadius > 0 ? dilate(keep, w, h, opts.dilateRadius) : keep;
  for (let i = 0; i < q.length; i++) q[i] *= gate[i];

  if (opts.featherRadius > 0) {
    q = boxFilter(q, w, h, opts.featherRadius);
  }
  return q;
}

/** Mean color (0..255) of pixels whose alpha is below `maxAlpha` — an estimate of the old background. */
export function estimateBackgroundColor(
  rgba: Uint8ClampedArray | Uint8Array,
  alpha: Float32Array,
  maxAlpha = 0.1,
): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let cnt = 0;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] <= maxAlpha) {
      const o = i * 4;
      r += rgba[o];
      g += rgba[o + 1];
      b += rgba[o + 2];
      cnt++;
    }
  }
  if (cnt === 0) return [255, 255, 255];
  return [r / cnt, g / cnt, b / cnt];
}

/** Luminance-weighted grayscale in [0,1] from RGBA. */
export function toGrayscale01(rgba: Uint8ClampedArray | Uint8Array, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    g[i] = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) / 255;
  }
  return g;
}

/**
 * Composite the subject over a flat new background, removing old-background spill.
 * Recovers the true foreground F from the matting equation C = αF + (1−α)·bgOld,
 * then recomposites F over bgNew: out = αF + (1−α)·bgNew. Pixels at α≈0 are set to
 * exactly bgNew so the new backdrop is perfectly uniform (required for passport use).
 * Writes RGBA into `out` (allocated if absent) and returns it.
 */
export function decontaminateComposite(
  src: Uint8ClampedArray | Uint8Array,
  alpha: Float32Array,
  bgOld: [number, number, number],
  bgNew: [number, number, number],
  n: number,
  out?: Uint8ClampedArray,
): Uint8ClampedArray {
  const dst = out ?? new Uint8ClampedArray(n * 4);
  const EPS = 0.02;
  for (let i = 0; i < n; i++) {
    const a = alpha[i];
    const o = i * 4;
    if (a <= EPS) {
      dst[o] = bgNew[0];
      dst[o + 1] = bgNew[1];
      dst[o + 2] = bgNew[2];
      dst[o + 3] = 255;
      continue;
    }
    const inv = 1 - a;
    for (let c = 0; c < 3; c++) {
      const C = src[o + c];
      let F = (C - inv * bgOld[c]) / a;
      if (F < 0) F = 0;
      else if (F > 255) F = 255;
      dst[o + c] = a * F + inv * bgNew[c]; // Uint8ClampedArray clamps to 0..255
    }
    dst[o + 3] = 255;
  }
  return dst;
}

/** Parse "#rrggbb" (or "#rgb") to an [r,g,b] 0..255 triplet. */
export function hexToRgb(hex: string): [number, number, number] {
  let s = hex.replace('#', '').trim();
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const num = parseInt(s, 16);
  if (Number.isNaN(num) || s.length !== 6) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
