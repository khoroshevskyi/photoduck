import { useEditor } from '../../store/editorStore';
import { getPreset } from '../../presets/documentPresets';
import { StepNav } from '../layout/StepNav';
import { CropStage } from '../crop/CropStage';
import { ComplianceBar } from '../compliance/ComplianceBar';
import { ToolTabs } from './ToolTabs';
import { FormatSelect } from './FormatSelect';
import { Icon } from '../common/Icon';

export function ModifyView() {
  const presetId = useEditor((s) => s.presetId);
  const setStep = useEditor((s) => s.setStep);
  const preset = getPreset(presetId);

  return (
    <div className="app__container">
      <div className="mb-6">
        <StepNav />
      </div>

      <div className="modify">
        <div className="modify__stage">
          <div className="card panel">
            <div className="stage-head mb-4">
              <span className="doctype__badge">{preset.badge}</span>
              <FormatSelect />
            </div>
            <CropStage />
            <div className="mt-4">
              <ComplianceBar />
            </div>
          </div>
        </div>

        <div className="modify__tools">
          <div className="card panel">
            <ToolTabs />
          </div>
          <div className="flex items-center justify-between mt-4 gap-3">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setStep('upload')}>
              <Icon name="chevronLeft" size={15} /> New photo
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setStep('download')}>
              Next: Download <Icon name="chevronRight" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
