// Shared render helpers: build render args from store state, live-preview a canvas,
// and export the single photo + print sheet.

import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { useEditor } from '../store/editorStore';
import { getPreset } from '../presets/documentPresets';
import { effectiveDpi, nativeExportHeight } from '../lib/geometry';
import { renderOutput, renderToCanvas, type ImageLike, type RenderArgs } from '../lib/imagePipeline';
import { downloadCanvas, renderSheet } from '../lib/exporters';

type State = ReturnType<typeof useEditor.getState>;

export function effectiveSource(s: State): ImageLike | null {
  if (!s.sourceImage) return null;
  if (s.background.replace && s.compositeSource) return s.compositeSource;
  return s.sourceImage;
}

export function buildRenderArgs(s: State, outHeight?: number): RenderArgs | null {
  const source = effectiveSource(s);
  if (!source) return null;
  return {
    source,
    transform: s.transform,
    preset: getPreset(s.presetId),
    adjustments: s.adjustments,
    outHeight,
    matteColor: s.background.replace ? s.background.color : '#ffffff',
  };
}

/** Re-render the final composed photo into a canvas whenever state changes. */
export function useLivePreview(canvasRef: RefObject<HTMLCanvasElement | null>, outHeight: number): void {
  const sourceImage = useEditor((s) => s.sourceImage);
  const transform = useEditor((s) => s.transform);
  const adjustments = useEditor((s) => s.adjustments);
  const background = useEditor((s) => s.background);
  const compositeSource = useEditor((s) => s.compositeSource);
  const presetId = useEditor((s) => s.presetId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const source = background.replace && compositeSource ? compositeSource : sourceImage;
    if (!source) return;
    renderToCanvas(canvas, {
      source,
      transform,
      preset: getPreset(presetId),
      adjustments,
      outHeight,
      matteColor: background.replace ? background.color : '#ffffff',
    });
  }, [canvasRef, sourceImage, transform, adjustments, background, compositeSource, presetId, outHeight]);
}

function filename(kind: string, type: string): string {
  const ext = type === 'image/png' ? 'png' : 'jpg';
  return `photoduck-${kind}-35x45.${ext}`;
}

export function useExport() {
  // Render at the source's native resolution (1:1, never upscaled) for best quality.
  const downloadPhoto = useCallback(async (type: 'image/jpeg' | 'image/png' = 'image/png') => {
    const s = useEditor.getState();
    const h = nativeExportHeight(getPreset(s.presetId), s.transform);
    const args = buildRenderArgs(s, h);
    if (!args) return;
    const canvas = renderOutput(args);
    await downloadCanvas(canvas, filename('photo', type), type, 0.95);
  }, []);

  const downloadSheet = useCallback(async (type: 'image/jpeg' | 'image/png' = 'image/png') => {
    const s = useEditor.getState();
    const preset = getPreset(s.presetId);
    const h = nativeExportHeight(preset, s.transform);
    const args = buildRenderArgs(s, h);
    if (!args) return;
    const photo = renderOutput(args);
    // Render the sheet at the photo's native DPI so each copy stays 1:1 (no downscaling).
    const sheet = renderSheet(photo, preset, effectiveDpi(preset, h));
    await downloadCanvas(sheet, filename('sheet-6up', type), type, 0.95);
  }, []);

  return { downloadPhoto, downloadSheet };
}
