import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useEditor } from '../../store/editorStore';
import { getPreset } from '../../presets/documentPresets';
import { useExport, useLivePreview } from '../../hooks/useRender';
import { nativeExportHeight, effectiveDpi } from '../../lib/geometry';
import { outputWidthFor } from '../../lib/imagePipeline';
import { StepNav } from '../layout/StepNav';
import { Icon } from '../common/Icon';

export function DownloadView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const presetId = useEditor((s) => s.presetId);
  const transform = useEditor((s) => s.transform);
  const preset = getPreset(presetId);
  useLivePreview(canvasRef, preset.outputPx.h);

  const { downloadPhoto, downloadSheet } = useExport();
  const setStep = useEditor((s) => s.setStep);
  const reset = useEditor((s) => s.reset);

  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [busy, setBusy] = useState<null | 'photo' | 'sheet'>(null);

  // What will actually be exported — the source sampled 1:1 (no upscaling).
  const nativeH = nativeExportHeight(preset, transform);
  const nativeW = outputWidthFor(preset, nativeH);
  const dpi = effectiveDpi(preset, nativeH);
  const belowStd = dpi < 300;

  const run = async (kind: 'photo' | 'sheet') => {
    setBusy(kind);
    try {
      if (kind === 'photo') await downloadPhoto(format);
      else await downloadSheet(format);
    } finally {
      setBusy(null);
    }
  };

  const frameStyle: CSSProperties = { aspectRatio: `${preset.photoMm.w} / ${preset.photoMm.h}` };

  return (
    <div className="app__container">
      <div className="mb-6">
        <StepNav />
      </div>

      <div className="download">
        <div className="card panel">
          <div className="panel__title">Your photo</div>
          <div className="download__frame" style={frameStyle}>
            <canvas ref={canvasRef} className="preview__canvas" />
          </div>
          <p className="help-text text-center">
            {preset.name}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`readout ${belowStd ? 'readout--warn' : 'readout--ok'}`}>
              {nativeW} × {nativeH}px · ~{dpi} DPI
            </span>
          </div>
          <p className="help-text text-center mt-2">
            Exported at the photo’s native resolution — sampled 1:1, never upscaled.
          </p>
          <button type="button" className="btn btn--ghost btn--sm mt-3" onClick={() => setStep('modify')}>
            <Icon name="chevronLeft" size={14} /> Back to editing
          </button>
        </div>

        <div className="card panel">
          <div className="panel__title">Download</div>

          {belowStd && (
            <div className="alert alert--error mb-4">
              This crop only reaches <strong>~{dpi} DPI</strong>, below the 300 DPI print standard.
              For best quality, go back and zoom out, or start over with a higher-resolution photo.
            </div>
          )}

          <div className="panel__title">File format</div>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              className={`btn btn--sm ${format === 'image/png' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setFormat('image/png')}
            >
              PNG · lossless
            </button>
            <button
              type="button"
              className={`btn btn--sm ${format === 'image/jpeg' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setFormat('image/jpeg')}
            >
              JPEG · smaller
            </button>
          </div>
          <p className="help-text mb-6">
            PNG is lossless — the best quality. JPEG is a smaller file with slight compression.
          </p>

          <button
            type="button"
            className="btn btn--primary btn--block mb-3"
            disabled={busy !== null}
            onClick={() => run('photo')}
          >
            {busy === 'photo' ? <span className="spinner" /> : <Icon name="download" size={16} />}
            Download single photo
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block mb-6"
            disabled={busy !== null}
            onClick={() => run('sheet')}
          >
            {busy === 'sheet' ? <span className="spinner spinner--dark" /> : <Icon name="printer" size={16} />}
            Download 6-up print sheet
          </button>

          <div className="alert alert--info">
            <strong>Printing tips</strong>
            <ul className="mt-2 pl-4 help-text list-disc">
              <li>Print the sheet on 10 × 15 cm (4 × 6″) glossy photo paper at a lab or kiosk.</li>
              <li>Set the lab to “actual size / no scaling” so the photo stays exact.</li>
              <li>Double-check your authority’s background color before submitting.</li>
            </ul>
          </div>

          <div className="divider" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
            <Icon name="rotate" size={14} /> Start over with a new photo
          </button>
        </div>
      </div>
    </div>
  );
}
