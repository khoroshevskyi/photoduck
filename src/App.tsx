import { useEditor } from './store/editorStore';
import { useBackgroundComposite } from './hooks/useBackgroundComposite';
import { useBackgroundAnalysis } from './hooks/useBackgroundAnalysis';

import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { UploadDropzone } from './components/upload/UploadDropzone';
import { ModifyView } from './components/modify/ModifyView';
import { DownloadView } from './components/download/DownloadView';

export default function App() {
  useBackgroundComposite();
  useBackgroundAnalysis();
  const step = useEditor((s) => s.step);
  const hasImage = useEditor((s) => s.sourceImage !== null);

  let view;
  if (step === 'upload' || !hasImage) view = <UploadDropzone />;
  else if (step === 'download') view = <DownloadView />;
  else view = <ModifyView />;

  return (
    <div className="app">
      <Header />
      <main className="flex-1">{view}</main>
      <Footer />
    </div>
  );
}
