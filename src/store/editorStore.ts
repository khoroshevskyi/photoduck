// Central editor state (Zustand). Holds the declarative EditorState from which
// every preview and export is rendered. Async ML orchestration lives in hooks.

import { create } from 'zustand';
import type {
  Adjustments,
  BackgroundSettings,
  CropTransform,
  DetectionResult,
  GuideLines,
  Size,
  Step,
} from '../types';
import { DEFAULT_ADJUSTMENTS } from '../types';
import { DEFAULT_PRESET_ID, getPreset } from '../presets/documentPresets';
import { autoFitTransform, clamp, defaultGuides, degToRad } from '../lib/geometry';
import type { BackgroundStats } from '../lib/backgroundCheck';

interface EditorState {
  step: Step;
  presetId: string;
  sourceImage: HTMLImageElement | null;
  sourceSize: Size | null;
  fileName: string | null;

  transform: CropTransform;
  guides: GuideLines;
  adjustments: Adjustments;
  rotationDeg: number;
  background: BackgroundSettings;

  detection: DetectionResult | null;
  detecting: boolean;

  /** cached canvas with background replaced (person composited over color) */
  compositeSource: HTMLCanvasElement | null;
  segmenting: boolean;

  /** sampled background statistics for the live background check */
  backgroundStats: BackgroundStats | null;

  // actions
  reset: () => void;
  setStep: (step: Step) => void;
  setPreset: (id: string) => void;
  setImage: (image: HTMLImageElement, size: Size, fileName: string) => void;
  updateTransform: (patch: Partial<CropTransform>) => void;
  zoomBy: (factor: number) => void;
  panBySource: (dx: number, dy: number) => void;
  setDetecting: (v: boolean) => void;
  setDetection: (d: DetectionResult | null) => void;
  autoFit: () => void;
  setAdjustments: (patch: Partial<Adjustments>) => void;
  resetAdjustments: () => void;
  setRotationDeg: (deg: number) => void;
  setBackground: (patch: Partial<BackgroundSettings>) => void;
  setCompositeSource: (c: HTMLCanvasElement | null) => void;
  setSegmenting: (v: boolean) => void;
  setBackgroundStats: (s: BackgroundStats | null) => void;
}

const IDENTITY_TRANSFORM: CropTransform = { scale: 1, cx: 0, cy: 0, rotation: 0 };

function initialTransform(size: Size, presetId: string): CropTransform {
  const preset = getPreset(presetId);
  // Cover the frame with the whole image, centered.
  const scale = Math.min(size.w / preset.outputPx.w, size.h / preset.outputPx.h);
  return { scale, cx: size.w / 2, cy: size.h / 2, rotation: 0 };
}

export const useEditor = create<EditorState>((set, get) => ({
  step: 'upload',
  presetId: DEFAULT_PRESET_ID,
  sourceImage: null,
  sourceSize: null,
  fileName: null,

  transform: IDENTITY_TRANSFORM,
  guides: defaultGuides(getPreset(DEFAULT_PRESET_ID)),
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  rotationDeg: 0,
  background: { replace: false, color: getPreset(DEFAULT_PRESET_ID).defaultBackgroundColor },

  detection: null,
  detecting: false,
  compositeSource: null,
  segmenting: false,
  backgroundStats: null,

  reset: () =>
    set((s) => ({
      step: 'upload',
      sourceImage: null,
      sourceSize: null,
      fileName: null,
      transform: IDENTITY_TRANSFORM,
      guides: defaultGuides(getPreset(s.presetId)),
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      rotationDeg: 0,
      background: { replace: false, color: getPreset(s.presetId).defaultBackgroundColor },
      detection: null,
      detecting: false,
      compositeSource: null,
      segmenting: false,
      backgroundStats: null,
    })),

  setStep: (step) => set({ step }),

  setPreset: (id) =>
    set((s) => {
      const preset = getPreset(id);
      const base = {
        presetId: id,
        guides: defaultGuides(preset),
        background: { replace: false, color: preset.defaultBackgroundColor },
        compositeSource: null,
      };
      if (s.sourceSize) {
        const transform = s.detection
          ? autoFitTransform(s.detection, preset, s.transform.rotation)
          : initialTransform(s.sourceSize, id);
        return { ...base, transform };
      }
      return base;
    }),

  setImage: (image, size, fileName) =>
    set((s) => ({
      sourceImage: image,
      sourceSize: size,
      fileName,
      transform: initialTransform(size, s.presetId),
      guides: defaultGuides(getPreset(s.presetId)),
      detection: null,
      compositeSource: null,
      step: 'modify',
    })),

  updateTransform: (patch) => set((s) => ({ transform: { ...s.transform, ...patch } })),

  zoomBy: (factor) =>
    set((s) => {
      const minScale = 0.05;
      const maxScale = s.sourceSize ? Math.max(s.sourceSize.w, s.sourceSize.h) / 50 : 50;
      // factor > 1 zooms IN (smaller scale = fewer source px per output px).
      const next = clamp(s.transform.scale / factor, minScale, maxScale);
      return { transform: { ...s.transform, scale: next } };
    }),

  panBySource: (dx, dy) =>
    set((s) => ({ transform: { ...s.transform, cx: s.transform.cx + dx, cy: s.transform.cy + dy } })),

  setDetecting: (v) => set({ detecting: v }),

  setDetection: (d) => set({ detection: d }),

  autoFit: () => {
    const { detection, presetId, transform } = get();
    if (!detection) return;
    const fitted = autoFitTransform(detection, getPreset(presetId), transform.rotation);
    set({ transform: fitted });
  },

  setAdjustments: (patch) => set((s) => ({ adjustments: { ...s.adjustments, ...patch } })),
  resetAdjustments: () => set({ adjustments: { ...DEFAULT_ADJUSTMENTS } }),

  setRotationDeg: (deg) =>
    set((s) => {
      const d = clamp(deg, -15, 15);
      return { rotationDeg: d, transform: { ...s.transform, rotation: degToRad(d) } };
    }),

  setBackground: (patch) => set((s) => ({ background: { ...s.background, ...patch } })),
  setCompositeSource: (c) => set({ compositeSource: c }),
  setSegmenting: (v) => set({ segmenting: v }),
  setBackgroundStats: (s) => set({ backgroundStats: s }),
}));
