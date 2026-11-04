import { useMemo } from 'react';
import { useEditor } from '../../store/editorStore';
import { getPreset } from '../../presets/documentPresets';
import { evaluateCompliance, type CheckStatus } from '../../lib/compliance';
import { Icon } from '../common/Icon';

const ICON: Record<CheckStatus, { name: 'check' | 'x' | 'move'; cls: string }> = {
  pass: { name: 'check', cls: 'check__icon--pass' },
  warn: { name: 'move', cls: 'check__icon--warn' },
  fail: { name: 'x', cls: 'check__icon--fail' },
  info: { name: 'move', cls: 'check__icon--info' },
};

export function ComplianceChecklist() {
  const presetId = useEditor((s) => s.presetId);
  const transform = useEditor((s) => s.transform);
  const detection = useEditor((s) => s.detection);
  const guides = useEditor((s) => s.guides);
  const background = useEditor((s) => s.background);
  const sourceSize = useEditor((s) => s.sourceSize);
  const backgroundStats = useEditor((s) => s.backgroundStats);

  const checks = useMemo(
    () =>
      evaluateCompliance({
        preset: getPreset(presetId),
        transform,
        detection,
        guides,
        background,
        sourceSize,
        backgroundStats,
      }),
    [presetId, transform, detection, guides, background, sourceSize, backgroundStats],
  );

  return (
    <div>
      <div className="panel__title">Compliance</div>
      <div className="checklist">
        {checks.map((c) => {
          const icon = ICON[c.status];
          return (
            <div key={c.id} className="check">
              <span className={`check__icon ${icon.cls}`}>
                <Icon name={icon.name} size={12} />
              </span>
              <div>
                <div className="check__label">{c.label}</div>
                <div className="check__detail">{c.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
