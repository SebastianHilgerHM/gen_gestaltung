import { useState, useRef, useCallback } from 'react';
import { Layers, Download, Eye } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import { PictureplaneProvider } from './state/PictureplaneStore.jsx';
import { usePictureplane } from './state/pictureplaneState.js';
import tools from './tools/index.js';
import './styles/index.css';

function AppShell() {
  const [activeTool, setActiveTool] = useState(tools[0].id);
  const activeCanvasRef = useRef(null);
  const {
    image,
    originalImage,
    previewOriginal,
    setPreviewOriginal,
  } = usePictureplane();

  const handleCanvasReady = useCallback((ref) => {
    activeCanvasRef.current = ref.current;
  }, []);

  const handleGlobalExport = useCallback(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pictureplane-${activeTool}.png`;
    a.click();
  }, [activeTool]);

  const ActiveTool = tools.find(t => t.id === activeTool)?.component;
  const canPreviewOriginal = !!(image && originalImage);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <Layers size={13} />
          </div>
          <span className="topbar-title">Pictureplane</span>
          <span className="topbar-subtitle">image processing</span>
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setPreviewOriginal(v => !v)}
            disabled={!canPreviewOriginal}
          >
            <Eye size={13} /> {previewOriginal ? 'Show edited' : 'Show original'}
          </button>
          <button className="btn btn-secondary" onClick={handleGlobalExport}>
            <Download size={13} /> Export PNG
          </button>
        </div>
      </header>

      <Sidebar
        activeTool={activeTool}
        onSelect={setActiveTool}
      />

      <main className="main-content">
        {ActiveTool && <ActiveTool onCanvasReady={handleCanvasReady} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <PictureplaneProvider>
      <AppShell />
    </PictureplaneProvider>
  );
}
