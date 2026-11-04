// Headless verification of the core cropping + compliance math, using the real
// source modules. Run: `npx tsx scripts/verify-geometry.ts`
//
// Note: the format JSON is loaded directly here (the app's loader uses Vite's
// import.meta.glob, which isn't available outside the bundler).

import {
  sourceToOutput,
  outputToSource,
  autoFitTransform,
  detectedHeadMm,
  detectedFracs,
  defaultGuides,
  nativeExportHeight,
  effectiveDpi,
} from '../src/lib/geometry';
import { outputWidthFor } from '../src/lib/imagePipeline';
import { sheetLayout } from '../src/lib/exporters';
import { evaluateCompliance } from '../src/lib/compliance';
import { evaluateBackgroundStats, type BackgroundStats } from '../src/lib/backgroundCheck';
import type { DocumentPreset, FormatSpec } from '../src/presets/documentPresets';
import type { DetectionResult } from '../src/types';
import europeanSpec from '../src/presets/formats/european.json';
import usSpec from '../src/presets/formats/us.json';

const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);
const toPreset = (s: FormatSpec): DocumentPreset => ({
  ...s,
  outputPx: { w: mmToPx(s.photoMm.w, s.dpi), h: mmToPx(s.photoMm.h, s.dpi) },
});

let fails = 0;
const approx = (name: string, got: number, want: number, tol = 0.5) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${got.toFixed(3)} (want ~${want})`);
};
const assert = (name: string, cond: boolean) => {
  if (!cond) fails++;
  console.log(`${cond ? '✓' : '✗'} ${name}`);
};

function checkPreset(preset: DocumentPreset, source: { w: number; h: number }, det: DetectionResult) {
  console.log(`\n── ${preset.name} — output ${preset.outputPx.w}x${preset.outputPx.h}px ──`);
  const fit = autoFitTransform(det, preset);
  console.log(`auto-fit: scale=${fit.scale.toFixed(3)} cx=${fit.cx.toFixed(0)} cy=${fit.cy.toFixed(0)}`);

  approx('head height == target', detectedHeadMm(det, fit, preset), preset.faceHeightMm.target, 0.2);
  const fr = detectedFracs(det, fit, preset);
  approx('crown at headroom margin', fr.crownFrac * preset.photoMm.h, preset.crownTopMarginMm, 0.2);
  approx('face centered (0.5)', fr.centerFrac, 0.5, 0.001);
  assert('no upscaling (scale >= 1)', fit.scale >= 1);

  const tl = outputToSource({ x: 0, y: 0 }, fit, preset.outputPx);
  const br = outputToSource({ x: preset.outputPx.w, y: preset.outputPx.h }, fit, preset.outputPx);
  assert('crop within source bounds', tl.x >= 0 && tl.y >= 0 && br.x <= source.w && br.y <= source.h);

  const checks = evaluateCompliance({
    preset,
    transform: fit,
    detection: det,
    guides: defaultGuides(preset),
    background: { replace: false, color: '#ffffff' },
    sourceSize: source,
    backgroundStats: whiteStats,
  });
  for (const c of checks) console.log(`   [${c.status.toUpperCase()}] ${c.label} — ${c.detail}`);
  for (const id of ['head-height', 'centering', 'resolution', 'eye-line', 'eyes-open', 'expression', 'background']) {
    assert(`${id} PASS`, checks.find((c) => c.id === id)?.status === 'pass');
  }

  // Native-resolution export: 1:1 sampling, no upscaling.
  const nH = nativeExportHeight(preset, fit);
  const nW = outputWidthFor(preset, nH);
  const dpi = effectiveDpi(preset, nH);
  console.log(`native export: ${nW} × ${nH}px · ~${dpi} DPI (300-DPI baseline = ${preset.outputPx.w}×${preset.outputPx.h})`);
  assert('native export is not upscaled past the source (>= 300-DPI size when scale>1)', nH >= preset.outputPx.h);
  approx('native DPI matches 300 × scale', dpi, 300 * fit.scale, 2);

  // Print sheet at the photo's native DPI: cells hold the photo ~1:1 (no downscaling).
  const sheet = sheetLayout(preset, dpi);
  console.log(
    `sheet @${dpi}DPI: ${sheet.sheetW}×${sheet.sheetH}px, ${sheet.cols}×${sheet.rows}=${sheet.cols * sheet.rows}-up, cell ${sheet.cellW}×${sheet.cellH}`,
  );
  assert('sheet fits 6 copies', sheet.cols * sheet.rows === 6);
  assert('sheet cell ~= native photo size (1:1, no downscale)', Math.abs(sheet.cellH - nH) <= 2);
}

// Inverse-mapping round trip (with rotation).
const euro = toPreset(europeanSpec as FormatSpec);
const t = { scale: 3.2, cx: 500, cy: 800, rotation: 0.12 };
const p = { x: 123, y: 456 };
const back = outputToSource(sourceToOutput(p, t, euro.outputPx), t, euro.outputPx);
approx('roundtrip X', back.x, p.x, 1e-6);
approx('roundtrip Y', back.y, p.y, 1e-6);

// Realistic 1737x3088 portrait, face upper-middle, eyes ~45% down the head.
const det: DetectionResult = {
  crownY: 520,
  chinY: 1180,
  faceCenterX: 868,
  eyeY: 520 + 0.45 * (1180 - 520),
  tiltRad: 0.01,
  confident: true,
  eyesOpen: true,
  expressionNeutral: true,
};

const whiteStats: BackgroundStats = {
  meanColor: [250, 250, 250],
  variation: 3,
  cornerDiff: 2,
  luminance: 250,
};

checkPreset(euro, { w: 1737, h: 3088 }, det);
const us = toPreset(usSpec as FormatSpec);
checkPreset(us, { w: 1737, h: 3088 }, det);

// Background check (pure) ----------------------------------------------------
console.log('\n── Background check ──');
assert('uniform white → pass', evaluateBackgroundStats(whiteStats, us.backgroundCheck, false, 'prohibited').status === 'pass');
assert(
  'gradient → warn',
  evaluateBackgroundStats({ ...whiteStats, cornerDiff: 60 }, us.backgroundCheck, false, 'prohibited').status === 'warn',
);
assert(
  'wrong color (blue) → warn',
  evaluateBackgroundStats({ meanColor: [120, 150, 220], variation: 4, cornerDiff: 3, luminance: 150 }, us.backgroundCheck, false, 'prohibited').status === 'warn',
);
assert('replaced + US prohibited → fail', evaluateBackgroundStats(whiteStats, us.backgroundCheck, true, 'prohibited').status === 'fail');
assert('replaced + discouraged → warn', evaluateBackgroundStats(whiteStats, us.backgroundCheck, true, 'discouraged').status === 'warn');

const closedDet: DetectionResult = { ...det, eyesOpen: false, expressionNeutral: false };
const cc = evaluateCompliance({
  preset: us,
  transform: autoFitTransform(closedDet, us),
  detection: closedDet,
  guides: defaultGuides(us),
  background: { replace: false, color: '#ffffff' },
  sourceSize: { w: 1737, h: 3088 },
  backgroundStats: whiteStats,
});
assert('closed eyes → eyes-open FAIL', cc.find((c) => c.id === 'eyes-open')?.status === 'fail');
assert('smiling → expression WARN', cc.find((c) => c.id === 'expression')?.status === 'warn');

console.log(fails === 0 ? '\n✅ ALL GEOMETRY/COMPLIANCE TESTS PASSED\n' : `\n❌ ${fails} FAILURE(S)\n`);
process.exit(fails ? 1 : 0);
