// Document-type presets are authored as JSON data in ./formats/*.json and
// auto-loaded here. Add a new format by dropping in another JSON file.

import type { Size } from '../types';

export interface BackgroundOption {
  id: string;
  label: string;
  color: string;
}

export interface FaceHeightSpec {
  min: number;
  max: number;
  target: number;
}

export interface Range {
  min: number;
  max: number;
}

/** How this authority treats digitally replaced backgrounds. */
export type BackgroundReplacementPolicy = 'prohibited' | 'discouraged';

/** Rules the live background check enforces. */
export interface BackgroundCheckSpec {
  label: string;
  /** required color, or null = any plain, light, uniform color */
  targetColor: string | null;
  /** max mean per-channel deviation from targetColor (0-255) */
  colorToleranceDelta: number;
  /** max allowed spread/gradient across sampled background (0-255) */
  uniformityDelta: number;
}

/** Raw JSON format spec (as authored in src/presets/formats/*.json). */
export interface FormatSpec {
  id: string;
  order: number;
  name: string;
  shortName: string;
  badge: string;
  note: string;
  photoMm: Size;
  dpi: number;
  faceHeightMm: FaceHeightSpec;
  crownTopMarginMm: number;
  eyeLineFromBottomMm: Range;
  backgroundOptions: BackgroundOption[];
  defaultBackgroundColor: string;
  backgroundCheck: BackgroundCheckSpec;
  backgroundReplacementPolicy: BackgroundReplacementPolicy;
}

/** Runtime preset = FormatSpec + computed output pixel size. */
export interface DocumentPreset extends FormatSpec {
  outputPx: Size;
}

const mmToPx = (mm: number, dpi: number): number => Math.round((mm / 25.4) * dpi);

function normalize(spec: FormatSpec): DocumentPreset {
  return {
    ...spec,
    outputPx: { w: mmToPx(spec.photoMm.w, spec.dpi), h: mmToPx(spec.photoMm.h, spec.dpi) },
  };
}

const modules = import.meta.glob<{ default: FormatSpec }>('./formats/*.json', { eager: true });

export const PRESETS: DocumentPreset[] = Object.values(modules)
  .map((m) => normalize(m.default))
  .sort((a, b) => a.order - b.order);

export const DEFAULT_PRESET_ID: string = PRESETS[0]?.id ?? 'european';

export const getPreset = (id: string): DocumentPreset =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[0];
