import { useEditor } from '../../store/editorStore';
import { getPreset } from '../../presets/documentPresets';
import { Switch } from '../common/Switch';

export function BackgroundPanel() {
  const background = useEditor((s) => s.background);
  const setBackground = useEditor((s) => s.setBackground);
  const segmenting = useEditor((s) => s.segmenting);
  const presetId = useEditor((s) => s.presetId);
  const preset = getPreset(presetId);

  return (
    <div>
      <div className="panel__title">Background</div>

      <Switch
        checked={background.replace}
        onChange={(replace) => setBackground({ replace })}
        label="Replace background"
      />

      <p className="help-text mt-3">
        Detects the person in your photo and places them on a clean, uniform background.
        Leave this off to keep your original backdrop.
      </p>

      {background.replace &&
        (preset.backgroundReplacementPolicy === 'prohibited' ? (
          <div className="alert alert--error mt-3" role="alert">
            <strong>Not allowed for {preset.shortName}.</strong> The US rejects photos with digitally
            replaced backgrounds (since Jan 2026). For a real submission, photograph yourself against a
            plain {preset.backgroundCheck.label} wall instead.
          </div>
        ) : (
          <div className="alert alert--info mt-3" role="alert">
            <strong>Use with caution.</strong> Some authorities reject digitally altered backgrounds.
            Prefer a real plain backdrop; only replace the background if your document’s rules allow it.
          </div>
        ))}

      {background.replace && (
        <>
          <div className="divider" />
          <div className="panel__title">Color</div>
          <div className="swatches mb-4">
            {preset.backgroundOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`swatch ${background.color.toLowerCase() === opt.color.toLowerCase() ? 'swatch--active' : ''}`}
                style={{ background: opt.color }}
                title={opt.label}
                aria-label={opt.label}
                onClick={() => setBackground({ color: opt.color })}
              />
            ))}
            <label className="swatch swatch--custom" title="Custom color">
              <input
                type="color"
                value={background.color}
                onChange={(e) => setBackground({ color: e.target.value })}
                className="hidden"
              />
            </label>
          </div>

          {segmenting && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="spinner spinner--dark" />
              Separating you from the background…
            </div>
          )}

          <p className="help-text mt-2">
            Germany requires a light-grey background; Poland and many visas require white. Pick the
            one your document needs.
          </p>
        </>
      )}
    </div>
  );
}
