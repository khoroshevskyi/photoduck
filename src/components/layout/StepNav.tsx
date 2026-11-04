import type { Step } from '../../types';
import { useEditor } from '../../store/editorStore';
import { Icon } from '../common/Icon';
import type { IconProps } from '../common/Icon';

const STEPS: { id: Step; label: string; icon: IconProps['name'] }[] = [
  { id: 'upload', label: 'Upload', icon: 'upload' },
  { id: 'modify', label: 'Modify', icon: 'sliders' },
  { id: 'download', label: 'Download', icon: 'download' },
];

export function StepNav() {
  const step = useEditor((s) => s.step);
  const setStep = useEditor((s) => s.setStep);
  const hasImage = useEditor((s) => s.sourceImage !== null);

  const activeIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <nav className="stepnav" aria-label="Editing steps">
      {STEPS.map((s, i) => {
        const isActive = s.id === step;
        const isDone = i < activeIndex;
        const disabled = s.id !== 'upload' && !hasImage;
        const cls = [
          'stepnav__item',
          isActive ? 'stepnav__item--active' : '',
          isDone ? 'stepnav__item--done' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={s.id}
            type="button"
            className={cls}
            disabled={disabled}
            onClick={() => setStep(s.id)}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="stepnav__num">
              {isDone ? <Icon name="check" size={13} /> : i + 1}
            </span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
