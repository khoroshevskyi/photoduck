import { useEditor } from '../../store/editorStore';
import { getPreset } from '../../presets/documentPresets';
import { detectedHeadMm, guideHeadMm } from '../../lib/geometry';
import { Icon } from '../common/Icon';
import { ComplianceChecklist } from '../compliance/ComplianceChecklist';

export function CropControls() {
  const detection = useEditor((s) => s.detection);
  const transform = useEditor((s) => s.transform);
  const presetId = useEditor((s) => s.presetId);
  const guides = useEditor((s) => s.guides);
  const zoomBy = useEditor((s) => s.zoomBy);
  const autoFit = useEditor((s) => s.autoFit);
  const panBySource = useEditor((s) => s.panBySource);
  const sourceSize = useEditor((s) => s.sourceSize);

  const preset = getPreset(presetId);
  const headMm = detection?.confident
    ? detectedHeadMm(detection, transform, preset)
    : guideHeadMm(guides, preset);

  const fh = preset.faceHeightMm;
  const status =
    headMm >= fh.min && headMm <= fh.max
      ? 'ok'
      : Math.abs(headMm - (headMm < fh.min ? fh.min : fh.max)) <= 1
        ? 'warn'
        : 'bad';

  const pct = (mm: number) => Math.round((mm / preset.photoMm.h) * 100);

  const recenter = () => {
    if (!sourceSize) return;
    const t = useEditor.getState().transform;
    panBySource(sourceSize.w / 2 - t.cx, 0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <span className="text-sm font-medium">Head height</span>
        <span className={`readout readout--${status}`}>
          {headMm.toFixed(1)} mm · {pct(headMm)}%
          <span className="text-xs font-normal">
            / {fh.min}–{fh.max} mm
          </span>
        </span>
      </div>
      <p className="help-text mb-4">
        Head should fill {pct(fh.min)}–{pct(fh.max)}% of the photo height.
      </p>

      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn--primary btn--sm" onClick={autoFit} disabled={!detection}>
          <Icon name="target" size={15} /> Auto-fit face
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => zoomBy(1.03)} aria-label="Zoom in">
          <Icon name="zoomIn" size={15} />
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => zoomBy(1 / 1.03)}
          aria-label="Zoom out"
        >
          <Icon name="zoomOut" size={15} />
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={recenter}>
          <Icon name="move" size={15} /> Center
        </button>
      </div>

      <p className="help-text mt-4">
        <Icon name="move" size={13} /> Drag the photo to reposition, scroll or pinch to zoom. Line the
        top of the head up with the <strong>Top of head</strong> guide and the chin with the{' '}
        <strong>Chin</strong> guide. <strong>Auto-fit face</strong> does this for you.
      </p>

      <div className="divider" />
      <ComplianceChecklist />
    </div>
  );
}
