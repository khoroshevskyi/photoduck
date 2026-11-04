import { useEditor } from '../../store/editorStore';
import { PRESETS } from '../../presets/documentPresets';
import { Icon } from '../common/Icon';

interface FormatSelectProps {
  id?: string;
}

/** Dropdown to pick the document format. Scales to many formats. */
export function FormatSelect({ id }: FormatSelectProps) {
  const presetId = useEditor((s) => s.presetId);
  const setPreset = useEditor((s) => s.setPreset);

  return (
    <div className="select">
      <select
        id={id}
        className="select__input"
        value={presetId}
        onChange={(e) => setPreset(e.target.value)}
        aria-label="Document format"
      >
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="select__arrow">
        <Icon name="chevronDown" size={16} />
      </span>
    </div>
  );
}
