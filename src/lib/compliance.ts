// Pure compliance evaluation. Produces a checklist from the current editor state.
// Uses detected face geometry when available, otherwise falls back to the guide lines.

import type { BackgroundSettings, CropTransform, DetectionResult, GuideLines, Size } from '../types';
import type { DocumentPreset } from '../presets/documentPresets';
import {
  detectedFracs,
  detectedHeadMm,
  guideHeadMm,
  radToDeg,
} from './geometry';
import { evaluateBackgroundStats, type BackgroundStats } from './backgroundCheck';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface ComplianceCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ComplianceInput {
  preset: DocumentPreset;
  transform: CropTransform;
  detection: DetectionResult | null;
  guides: GuideLines;
  background: BackgroundSettings;
  sourceSize: Size | null;
  backgroundStats: BackgroundStats | null;
}

const band = (value: number, min: number, max: number, tol: number): CheckStatus => {
  if (value >= min && value <= max) return 'pass';
  if (value >= min - tol && value <= max + tol) return 'warn';
  return 'fail';
};

export function evaluateCompliance(input: ComplianceInput): ComplianceCheck[] {
  const { preset, transform, detection, guides, background, backgroundStats } = input;
  const checks: ComplianceCheck[] = [];
  const fh = preset.faceHeightMm;

  // 1. Head height -------------------------------------------------------------
  const headMm = detection?.confident
    ? detectedHeadMm(detection, transform, preset)
    : guideHeadMm(guides, preset);
  const pct = (mm: number) => Math.round((mm / preset.photoMm.h) * 100);
  checks.push({
    id: 'head-height',
    label: 'Head height',
    status: band(headMm, fh.min, fh.max, 1),
    detail: `${headMm.toFixed(1)} mm · ${pct(headMm)}% (needs ${fh.min}–${fh.max} mm · ${pct(fh.min)}–${pct(fh.max)}%)`,
  });

  const fracs = detection?.confident ? detectedFracs(detection, transform, preset) : null;

  // 2. Horizontal centering ----------------------------------------------------
  if (fracs) {
    const off = Math.abs(0.5 - fracs.centerFrac);
    const status: CheckStatus = off < 0.05 ? 'pass' : off < 0.1 ? 'warn' : 'fail';
    checks.push({
      id: 'centering',
      label: 'Face centered',
      status,
      detail: status === 'pass' ? 'Centered horizontally' : 'Move the face to the horizontal center',
    });
  } else {
    checks.push({
      id: 'centering',
      label: 'Face centered',
      status: 'info',
      detail: 'Center the face horizontally in the frame',
    });
  }

  // 3. Head upright (roll) -----------------------------------------------------
  if (detection?.confident) {
    const deg = Math.abs(radToDeg(detection.tiltRad));
    const status: CheckStatus = deg < 3 ? 'pass' : deg < 6 ? 'warn' : 'fail';
    checks.push({
      id: 'level',
      label: 'Head upright',
      status,
      detail: status === 'pass' ? 'Eyes are level' : `Tilted ${deg.toFixed(1)}° — use Straighten`,
    });
  }

  // 3b. Eyes open & neutral expression (blendshapes) ---------------------------
  if (detection?.confident) {
    checks.push({
      id: 'eyes-open',
      label: 'Eyes open',
      status: detection.eyesOpen ? 'pass' : 'fail',
      detail: detection.eyesOpen ? 'Both eyes are open' : 'Both eyes must be open',
    });
    checks.push({
      id: 'expression',
      label: 'Neutral expression',
      status: detection.expressionNeutral ? 'pass' : 'warn',
      detail: detection.expressionNeutral
        ? 'Neutral — mouth closed'
        : 'Relax your expression: mouth closed, no smile',
    });
  }

  // 4. Eye line position -------------------------------------------------------
  if (fracs) {
    const eyeFromBottom = (1 - fracs.eyeFrac) * preset.photoMm.h;
    const el = preset.eyeLineFromBottomMm;
    checks.push({
      id: 'eye-line',
      label: 'Eye position',
      status: band(eyeFromBottom, el.min, el.max, 2),
      detail: `${eyeFromBottom.toFixed(1)} mm from bottom (needs ${el.min}–${el.max} mm)`,
    });
  }

  // 5. Resolution --------------------------------------------------------------
  // transform.scale = source px per output px. >= 1 means no upscaling.
  const resStatus: CheckStatus = transform.scale >= 1 ? 'pass' : transform.scale >= 0.7 ? 'warn' : 'fail';
  checks.push({
    id: 'resolution',
    label: 'Resolution',
    status: resStatus,
    detail:
      resStatus === 'pass'
        ? 'Sharp enough for print'
        : 'Image is being enlarged — may look soft in print',
  });

  // 6. Background --------------------------------------------------------------
  const bg = evaluateBackgroundStats(
    backgroundStats,
    preset.backgroundCheck,
    background.replace,
    preset.backgroundReplacementPolicy,
  );
  checks.push({ id: 'background', label: 'Background', status: bg.status, detail: bg.detail });

  return checks;
}

export function complianceScore(checks: ComplianceCheck[]): {
  failures: number;
  warnings: number;
  ok: boolean;
} {
  const failures = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;
  return { failures, warnings, ok: failures === 0 };
}
