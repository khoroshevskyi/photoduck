// Renders a small output canvas on each edit and samples its background so the
// compliance check can judge uniformity + color. Cheap (≈140px tall canvas).

import { useEffect } from 'react';
import { useEditor } from '../store/editorStore';
import { getPreset } from '../presets/documentPresets';
import { renderToCanvas } from '../lib/imagePipeline';
import { analyzeBackground } from '../lib/backgroundCheck';

export function useBackgroundAnalysis(): void {
  const sourceImage = useEditor((s) => s.sourceImage);
  const transform = useEditor((s) => s.transform);
  const adjustments = useEditor((s) => s.adjustments);
  const background = useEditor((s) => s.background);
  const compositeSource = useEditor((s) => s.compositeSource);
  const presetId = useEditor((s) => s.presetId);
  const setBackgroundStats = useEditor((s) => s.setBackgroundStats);

  useEffect(() => {
    if (!sourceImage) {
      setBackgroundStats(null);
      return;
    }
    const source = background.replace && compositeSource ? compositeSource : sourceImage;
    const canvas = document.createElement('canvas');
    renderToCanvas(canvas, {
      source,
      transform,
      preset: getPreset(presetId),
      adjustments,
      outHeight: 140,
      matteColor: background.replace ? background.color : '#ffffff',
    });
    setBackgroundStats(analyzeBackground(canvas));
  }, [sourceImage, transform, adjustments, background, compositeSource, presetId, setBackgroundStats]);
}
