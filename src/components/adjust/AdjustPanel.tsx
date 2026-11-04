import { useEditor } from '../../store/editorStore';
import { Slider } from './Slider';
import { Icon } from '../common/Icon';

export function AdjustPanel() {
  const adjustments = useEditor((s) => s.adjustments);
  const setAdjustments = useEditor((s) => s.setAdjustments);
  const resetAdjustments = useEditor((s) => s.resetAdjustments);
  const rotationDeg = useEditor((s) => s.rotationDeg);
  const setRotationDeg = useEditor((s) => s.setRotationDeg);

  return (
    <div>
      <div className="panel__title">
        <span>Light &amp; color</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={resetAdjustments}>
          <Icon name="rotate" size={13} /> Reset
        </button>
      </div>

      <Slider
        label="Brightness"
        value={adjustments.brightness}
        min={-100}
        max={100}
        onChange={(brightness) => setAdjustments({ brightness })}
      />
      <Slider
        label="Contrast"
        value={adjustments.contrast}
        min={-100}
        max={100}
        onChange={(contrast) => setAdjustments({ contrast })}
      />
      <Slider
        label="Exposure"
        value={adjustments.exposure}
        min={-100}
        max={100}
        onChange={(exposure) => setAdjustments({ exposure })}
      />

      <div className="divider" />
      <div className="panel__title">White balance</div>
      <Slider
        label="Saturation"
        value={adjustments.saturation}
        min={-100}
        max={100}
        onChange={(saturation) => setAdjustments({ saturation })}
      />
      <Slider
        label="Temperature"
        value={adjustments.temperature}
        min={-100}
        max={100}
        onChange={(temperature) => setAdjustments({ temperature })}
      />

      <div className="divider" />
      <div className="panel__title">Straighten</div>
      <Slider
        label="Rotation"
        value={rotationDeg}
        min={-15}
        max={15}
        step={0.5}
        suffix="°"
        onChange={setRotationDeg}
      />
      <p className="help-text">Keep the eyes level and the head upright for a compliant photo.</p>
    </div>
  );
}
