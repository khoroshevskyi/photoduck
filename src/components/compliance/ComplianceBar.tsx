import { useMemo } from 'react';
import { useEditor } from '../../store/editorStore';
import { getPreset } from '../../presets/documentPresets';
import { evaluateCompliance, type CheckStatus } from '../../lib/compliance';
import { Icon } from '../common/Icon';

const CHIP: Record<CheckStatus, { name: 'check' | 'x' | 'move'; cls: string }> = {
  pass: { name: 'check', cls: 'chip--pass' },
  warn: { name: 'move', cls: 'chip--warn' },
  fail: { name: 'x', cls: 'chip--fail' },
  info: { name: 'move', cls: 'chip--info' },
};

/** Compact, always-visible pass/warn strip shown under the photo. */
export function ComplianceBar() {
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
    <div className="compliance-bar" role="status" aria-label="Compliance checks">
      {checks.map((c) => {
        const chip = CHIP[c.status];
        return (
          <span key={c.id} className={`chip ${chip.cls}`} title={c.detail}>
            <Icon name={chip.name} size={12} />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}
