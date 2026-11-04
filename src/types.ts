// Core domain types for the PhotoDoc editor.

export type Step = 'upload' | 'modify' | 'download';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Tonal / color adjustments. Each value is a user-facing -100..100 slider (0 = untouched). */
export interface Adjustments {
  brightness: number;
  contrast: number;
  exposure: number;
  saturation: number;
  /** negative = cooler (blue), positive = warmer (orange) */
  temperature: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  saturation: 0,
  temperature: 0,
};

export interface BackgroundSettings {
  replace: boolean;
  /** hex color used when `replace` is true */
  color: string;
}

/**
 * Places the source image behind the fixed 35:45 output frame.
 * `scale` = source pixels per OUTPUT pixel (reference output = 413x531).
 * `cx,cy` = the source point mapped to the output frame center.
 * `rotation` = straightening angle in radians.
 */
export interface CropTransform {
  scale: number;
  cx: number;
  cy: number;
  rotation: number;
}

/** Visual target lines, expressed as a fraction (0..1) of the output frame height. */
export interface GuideLines {
  crownFrac: number;
  chinFrac: number;
}

/** Face detection result, in SOURCE image pixel coordinates. */
export interface DetectionResult {
  crownY: number;
  chinY: number;
  faceCenterX: number;
  eyeY: number;
  /** head roll angle in radians (0 = level) */
  tiltRad: number;
  confident: boolean;
  /** both eyes open (from blendshapes); true if blendshapes unavailable */
  eyesOpen: boolean;
  /** mouth closed & no big smile (from blendshapes); true if unavailable */
  expressionNeutral: boolean;
}
