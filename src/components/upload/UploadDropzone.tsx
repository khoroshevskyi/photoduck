import { useRef, useState } from 'react';
import { usePhotoProcessing } from '../../hooks/usePhotoProcessing';
import { Icon } from '../common/Icon';
import { FormatSelect } from '../modify/FormatSelect';

export function UploadDropzone() {
  const { handleFile, error } = usePhotoProcessing();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void handleFile(file);
  };

  // Dev-only: load a bundled sample so the flow can be exercised without a file dialog.
  const loadSample = async (name: string) => {
    const res = await fetch(`${import.meta.env.BASE_URL}samples/${name}`);
    const blob = await res.blob();
    void handleFile(new File([blob], name, { type: blob.type || 'image/jpeg' }));
  };

  return (
    <section className="app__container">
      <div className="hero">
        <h1 className="hero__title">
          Compliant passport &amp; ID photos, <em>made simple</em>
        </h1>
        <p className="hero__subtitle">
          Pick your document type, drop in a portrait, and photoDuck auto-aligns the face, checks
          every compliance rule, and hands you a print-ready photo plus a print sheet. European
          35 × 45 mm, Poland and US 2 × 2 in supported.
        </p>
        <img
          className="hero__art"
          src={`${import.meta.env.BASE_URL}og-image.svg`}
          alt="photoDuck turns a portrait into a compliant biometric document photo with face guides and compliance checks"
          width={1200}
          height={630}
          loading="eager"
        />
      </div>

      <div className="format-picker">
        <span className="text-sm font-medium">What is this photo for?</span>
        <FormatSelect />
      </div>

      <div
        className={`dropzone ${dragging ? 'dropzone--drag' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        <div className="dropzone__icon">
          <Icon name="upload" size={28} />
        </div>
        <p className="text-lg font-semibold mb-1">Drop a photo here, or click to browse</p>
        <p className="dropzone__hint">JPEG, PNG or WebP · a clear, front-facing portrait works best</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="alert alert--error mt-4" role="alert">
          {error}
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="flex gap-2 justify-center mt-4">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => loadSample('sample.jpg')}>
            Load test sample 1
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => loadSample('sample2.jpg')}>
            Load test sample 2
          </button>
        </div>
      )}

      <div className="feature-row mt-8">
        <span className="feature">
          <Icon name="target" size={16} /> Auto face alignment
        </span>
        <span className="feature">
          <Icon name="crop" size={16} /> Head-size &amp; compliance checks
        </span>
        <span className="feature">
          <Icon name="layers" size={16} /> Optional background swap
        </span>
        <span className="feature">
          <Icon name="printer" size={16} /> Single photo + print sheet
        </span>
        <span className="feature">
          <Icon name="lock" size={16} /> 100% private, on-device
        </span>
      </div>
    </section>
  );
}
