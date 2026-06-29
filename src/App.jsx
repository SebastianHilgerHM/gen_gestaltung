import { useState, useRef, useCallback } from 'react';
import { Layers, Download, Eye, LayoutGrid } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import FormatPicker from './components/FormatPicker.jsx';
import { PictureplaneProvider } from './state/PictureplaneStore.jsx';
import { usePictureplane } from './state/pictureplaneState.js';
import tabs from './tools/index.js';
import './styles/index.css';

function AppShell() {
  const [stage, setStage] = useState('home');
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [toolId, setToolId] = useState(tabs[0].tools[0].id);
  const activeCanvasRef = useRef(null);
  const {
    format,
    setFormat,
    image,
    originalImage,
    previewOriginal,
    setPreviewOriginal,
  } = usePictureplane();

  const handleCanvasReady = useCallback((ref) => {
    activeCanvasRef.current = ref.current;
  }, []);

  const selectFormat = useCallback((fmt) => {
    setFormat(fmt);
    setStage('editor');
  }, [setFormat]);

  const selectTab = useCallback((id) => {
    setActiveTabId(id);
    setToolId(tabs.find(tab => tab.id === id).tools[0].id);
  }, []);

  const handleGlobalExport = useCallback(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    let url;
    if (format?.width && format?.height) {
      const out = document.createElement('canvas');
      out.width = format.width;
      out.height = format.height;
      const ctx = out.getContext('2d');
      const scale = Math.min(format.width / canvas.width, format.height / canvas.height);
      const w = canvas.width * scale;
      const h = canvas.height * scale;
      ctx.drawImage(canvas, (format.width - w) / 2, (format.height - h) / 2, w, h);
      url = out.toDataURL('image/png');
    } else {
      url = canvas.toDataURL('image/png');
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `pictureplane-${toolId}.png`;
    a.click();
  }, [format, toolId]);

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const ActiveTool = activeTab.tools.find(tool => tool.id === toolId)?.component;
  const canPreviewOriginal = !!(image && originalImage);
  const formatLabel = format
    ? format.width && format.height
      ? `${format.label} · ${format.width}×${format.height}`
      : format.label
    : null;

  return (
    <div className={`app${stage === 'home' ? ' home' : ''}`}>
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <Layers size={13} />
          </div>
          <span className="topbar-title">Pictureplane</span>
          <span className="topbar-subtitle">image processing</span>
        </div>
        {stage === 'editor' && (
          <div className="topbar-actions">
            <button className="btn btn-ghost" onClick={() => setStage('home')} title="Format ändern">
              <LayoutGrid size={13} /> {formatLabel ?? 'Format'}
            </button>
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
        )}
      </header>

      {stage === 'home' ? (
        <FormatPicker onSelect={selectFormat} />
      ) : (
        <>
          <Sidebar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={selectTab}
            toolId={toolId}
            onSelectTool={setToolId}
          />
          <main className="main-content">
            {ActiveTool && <ActiveTool onCanvasReady={handleCanvasReady} />}
          </main>
        </>
      )}
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
