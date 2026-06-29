import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Sparkles, Download, RefreshCw } from 'lucide-react';
import { usePictureplane } from '../../state/pictureplaneState.js';
import { renderComposite, TICKET_FIELDS } from '../../templates/index.js';

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function GalleryCollage() {
  const { format } = usePictureplane();
  const [source, setSource] = useState(null);
  const [resultImg, setResultImg] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [fields, setFields] = useState(TICKET_FIELDS);
  const inputRef = useRef(null);
  const canvasRef = useRef(null);

  const isTicket = format?.id === 'ticket';

  const loadFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setSource(await fileToDataUrl(file));
    setResultImg(null);
    setError(null);
  }, []);

  useEffect(() => {
    const onPaste = (e) => {
      const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
      if (item) loadFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  useEffect(() => {
    if (canvasRef.current) {
      renderComposite(canvasRef.current, { format, img: resultImg, fields });
    }
  }, [format, resultImg, fields]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    loadFile(e.dataTransfer.files[0]);
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setResultImg(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const img = new Image();
      img.onload = () => setResultImg(img);
      img.src = data.images[0];
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `${format?.id ?? 'composite'}.png`;
    a.click();
  };

  const setField = (key, value) => setFields(f => ({ ...f, [key]: value }));

  return (
    <div className="tool-wrapper">
      <div className="editor-shell">
        <section className="workspace">
          <div className="canvas-area" style={{ gap: 16, flexWrap: 'wrap' }}>
            {!source ? (
              <div
                className={`drop-zone${dragging ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current.click()}
              >
                <Upload size={28} className="drop-zone-icon" />
                <div className="drop-zone-text">Drop, click or paste an image</div>
                <div className="drop-zone-hint">Ctrl+V works too</div>
              </div>
            ) : (
              <>
                <figure style={{ margin: 0, textAlign: 'center' }}>
                  <figcaption style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Source</figcaption>
                  <img src={source} alt="source" style={{ maxWidth: 320, maxHeight: 440, borderRadius: 6 }} />
                </figure>
                <figure style={{ margin: 0, textAlign: 'center' }}>
                  <figcaption style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {format?.label ?? 'Result'} {generating && '· generating…'}
                  </figcaption>
                  <canvas
                    ref={canvasRef}
                    style={{ maxWidth: 560, maxHeight: '60vh', width: 'auto', height: 'auto', borderRadius: 6, background: 'transparent' }}
                  />
                </figure>
              </>
            )}
          </div>
        </section>

        <aside className="properties-panel">
          <div className="tool-heading">
            <div className="tool-title">Gallery Collage</div>
            <div className="tool-description">AI inpainting placed into your {format?.label ?? 'format'}</div>
          </div>

          <div className="panel-actions">
            {generating && <span className="badge badge-processing">Generating...</span>}
            <button className="btn btn-secondary" onClick={() => inputRef.current.click()}>
              <Upload size={13} /> Load image
            </button>
            <button className="btn btn-primary" onClick={generate} disabled={!source || generating}>
              <Sparkles size={13} /> Generate
            </button>
            <button className="btn btn-secondary" onClick={download} disabled={!source}>
              <Download size={13} /> Download
            </button>
          </div>

          {source && (
            <button className="btn btn-ghost btn-full" onClick={() => { setSource(null); setResultImg(null); setError(null); }}>
              <RefreshCw size={12} /> Clear
            </button>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.5 }}>{error}</div>
          )}

          {isTicket && (
            <div className="control-group">
              <div className="control-group-label">Ticket-Texte</div>
              <div className="control-row">
                <label className="control-label">Marke (oben)</label>
                <input type="text" value={fields.brandTop} onChange={e => setField('brandTop', e.target.value)} />
              </div>
              <div className="control-row">
                <label className="control-label">Marke (unten)</label>
                <input type="text" value={fields.brandBottom} onChange={e => setField('brandBottom', e.target.value)} />
              </div>
              <div className="control-row">
                <label className="control-label">Preiszeile</label>
                <input type="text" value={fields.priceMain} onChange={e => setField('priceMain', e.target.value)} />
              </div>
              <div className="control-row">
                <label className="control-label">Zusatz</label>
                <input type="text" value={fields.priceSub} onChange={e => setField('priceSub', e.target.value)} />
              </div>
            </div>
          )}

          <div className="divider" />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Bild hochladen oder einfügen, generieren – das Ergebnis wird in den
            Bildbereich des {format?.label ?? 'Formats'} gesetzt. Download exportiert in voller Auflösung.
          </div>
        </aside>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => loadFile(e.target.files[0])}
      />
    </div>
  );
}
