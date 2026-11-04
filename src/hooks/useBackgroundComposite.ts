// Runs person segmentation + mask refinement (once per image / ROI, cached) and
// composites the subject over the chosen background color whenever replacement is
// enabled. Segmentation + refinement are the expensive, color-independent part;
// changing the color only re-runs the cheap composite.

import { useEffect, useRef } from 'react';
import { useEditor } from '../store/editorStore';
import { computePersonRoi, segmentPerson, type RawMask } from '../lib/segmentation';
import { compositeMatte, refineMatte, type RefinedMatte } from '../lib/imagePipeline';

interface Cached {
  image: HTMLImageElement;
  roiKey: string;
  matte: RefinedMatte;
}

export function useBackgroundComposite(): void {
  const sourceImage = useEditor((s) => s.sourceImage);
  const sourceSize = useEditor((s) => s.sourceSize);
  const detection = useEditor((s) => s.detection);
  const replace = useEditor((s) => s.background.replace);
  const color = useEditor((s) => s.background.color);
  const setCompositeSource = useEditor((s) => s.setCompositeSource);
  const setSegmenting = useEditor((s) => s.setSegmenting);

  const cacheRef = useRef<Cached | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sourceImage || !sourceSize || !replace) {
      setCompositeSource(null);
      return;
    }

    const roi = computePersonRoi(detection, sourceSize);
    const roiKey = `${roi.x},${roi.y},${roi.w},${roi.h}`;

    (async () => {
      setSegmenting(true);
      try {
        let cached = cacheRef.current;
        if (!cached || cached.image !== sourceImage || cached.roiKey !== roiKey) {
          const raw: RawMask | null = await segmentPerson(sourceImage, roi);
          if (cancelled) return;
          if (!raw) {
            cacheRef.current = null;
            setCompositeSource(null);
            return;
          }
          const matte = refineMatte(sourceImage, raw);
          if (cancelled) return;
          cached = { image: sourceImage, roiKey, matte };
          cacheRef.current = cached;
        }
        const composite = compositeMatte(sourceImage, cached.matte, color);
        if (!cancelled) setCompositeSource(composite);
      } finally {
        if (!cancelled) setSegmenting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceImage, sourceSize, detection, replace, color, setCompositeSource, setSegmenting]);
}
