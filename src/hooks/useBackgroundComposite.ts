// Runs person segmentation (once per image, cached) and composites the subject
// over the chosen background color whenever replacement is enabled.

import { useEffect, useRef } from 'react';
import { useEditor } from '../store/editorStore';
import { segmentPerson } from '../lib/segmentation';
import { compositeBackground } from '../lib/imagePipeline';

export function useBackgroundComposite(): void {
  const sourceImage = useEditor((s) => s.sourceImage);
  const replace = useEditor((s) => s.background.replace);
  const color = useEditor((s) => s.background.color);
  const setCompositeSource = useEditor((s) => s.setCompositeSource);
  const setSegmenting = useEditor((s) => s.setSegmenting);

  const maskRef = useRef<{ image: HTMLImageElement; mask: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sourceImage || !replace) {
      setCompositeSource(null);
      return;
    }

    (async () => {
      setSegmenting(true);
      try {
        let mask = maskRef.current?.image === sourceImage ? maskRef.current.mask : null;
        if (!mask) {
          mask = await segmentPerson(sourceImage);
          if (mask) maskRef.current = { image: sourceImage, mask };
        }
        if (cancelled) return;
        if (!mask) {
          setCompositeSource(null);
          return;
        }
        const composite = compositeBackground(sourceImage, mask, color);
        if (!cancelled) setCompositeSource(composite);
      } finally {
        if (!cancelled) setSegmenting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceImage, replace, color, setCompositeSource, setSegmenting]);
}
