import { useState } from 'react';
import { CropControls } from '../crop/CropControls';
import { AdjustPanel } from '../adjust/AdjustPanel';
import { BackgroundPanel } from '../background/BackgroundPanel';
import { Icon } from '../common/Icon';
import type { IconProps } from '../common/Icon';

type Tool = 'position' | 'enhance' | 'background';

const TABS: { id: Tool; label: string; icon: IconProps['name'] }[] = [
  { id: 'position', label: 'Position', icon: 'crop' },
  { id: 'enhance', label: 'Enhance', icon: 'sliders' },
  { id: 'background', label: 'Background', icon: 'layers' },
];

export function ToolTabs() {
  const [active, setActive] = useState<Tool>('position');

  return (
    <div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={`tab ${active === t.id ? 'tab--active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {active === 'position' && <CropControls />}
        {active === 'enhance' && <AdjustPanel />}
        {active === 'background' && <BackgroundPanel />}
      </div>
    </div>
  );
}
