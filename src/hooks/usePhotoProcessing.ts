// Orchestrates loading a file and running face detection + auto-fit.

import { useCallback, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { loadImageFile } from '../lib/loadImageFile';
import { detectFace } from '../lib/faceDetection';

export function usePhotoProcessing() {
  const [error, setError] = useState<string | null>(null);
  const setImage = useEditor((s) => s.setImage);
  const setDetecting = useEditor((s) => s.setDetecting);
  const setDetection = useEditor((s) => s.setDetection);
  const autoFit = useEditor((s) => s.autoFit);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const { image, size } = await loadImageFile(file);
        setImage(image, size, file.name);
        setDetecting(true);
        try {
          const detection = await detectFace(image);
          setDetection(detection);
          if (detection) autoFit();
        } finally {
          setDetecting(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load image.');
      }
    },
    [setImage, setDetecting, setDetection, autoFit],
  );

  return { handleFile, error };
}
