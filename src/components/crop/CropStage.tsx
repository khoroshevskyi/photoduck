import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useEditor } from '../../store/editorStore';
import { useLivePreview } from '../../hooks/useRender';
import { getPreset } from '../../presets/documentPresets';
import { detectedFracs } from '../../lib/geometry';

export function CropStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLivePreview(canvasRef, 720);

  const guides = useEditor((s) => s.guides);
  const detection = useEditor((s) => s.detection);
  const detecting = useEditor((s) => s.detecting);
  const transform = useEditor((s) => s.transform);
  const presetId = useEditor((s) => s.presetId);
  const panBySource = useEditor((s) => s.panBySource);
  const zoomBy = useEditor((s) => s.zoomBy);

  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);

  // Non-passive wheel zoom.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.06 : 1 / 1.06);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const sourcePerCss = () => {
    const h = stageRef.current?.clientHeight ?? 1;
    const scale = useEditor.getState().transform.scale;
    return (scale * getPreset(presetId).outputPx.h) / h;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      drag.current.active = false;
      return;
    }
    drag.current = { active: true, x: e.clientX, y: e.clientY };
    setGrabbing(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    // Pinch-to-zoom.
    if (pointers.current.size === 2 && pinchDist.current != null) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) zoomBy(dist / pinchDist.current);
      pinchDist.current = dist;
      return;
    }
    if (!drag.current.active) return;
    const k = sourcePerCss();
    panBySource(-(e.clientX - drag.current.x) * k, -(e.clientY - drag.current.y) * k);
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
  };

  const endPointer = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
    if (pointers.current.size === 0) {
      drag.current.active = false;
      setGrabbing(false);
    }
  };

  const preset = getPreset(presetId);
  const dots = detection?.confident ? detectedFracs(detection, transform, preset) : null;
  const stageStyle: CSSProperties = { aspectRatio: `${preset.photoMm.w} / ${preset.photoMm.h}` };

  return (
    <div
      ref={stageRef}
      className={`stage ${grabbing ? 'stage--grabbing' : ''}`}
      style={stageStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <canvas ref={canvasRef} className="stage__canvas" />
      <div className="stage__frame" />

      {/* detected-face markers (where the app thinks the head currently is) */}
      {dots && (
        <>
          <span
            className="detect-dot"
            style={{ left: `${dots.centerFrac * 100}%`, top: `${dots.crownFrac * 100}%` }}
          />
          <span
            className="detect-dot"
            style={{ left: `${dots.centerFrac * 100}%`, top: `${dots.chinFrac * 100}%` }}
          />
        </>
      )}

      {/* fixed target guide lines (not part of the exported photo) */}
      <div className="guide guide--crown" style={{ top: `${guides.crownFrac * 100}%` }}>
        <span className="guide__label">Top of head</span>
      </div>
      <div className="guide guide--chin" style={{ top: `${guides.chinFrac * 100}%` }}>
        <span className="guide__label">Chin</span>
      </div>

      {detecting && (
        <div className="stage__status">
          <span className="spinner" />
          Detecting face…
        </div>
      )}
    </div>
  );
}
