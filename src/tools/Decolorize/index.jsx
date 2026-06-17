import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Upload, RefreshCw, Download, Check } from 'lucide-react';
import CanvasViewport from '../../components/CanvasViewport.jsx';
import LayersStrip from '../../components/LayersStrip.jsx';
import { useFilePicker } from '../../hooks/useFilePicker.js';
import { useCanvasExport } from '../../hooks/useCanvasExport.js';
import { putPixels } from '../../utils/imageData.js';
import {
  DECOLORIZE_DEFAULTS,
  usePictureplane,
} from '../../state/pictureplaneState.js';
import { decolorize } from './process.js';

const DISPLAY_MAX = 700;

export default function Decolorize({ onCanvasReady }) {
  const {
    image,
    originalImage,
    previewOriginal,
    layers,
    decolorize: state,
    loadImageFile,
    applyImageData,
    setDecolorize,
  } = usePictureplane();
  const {
    inputRef,
    onInputChange,
    ...picker
  } = useFilePicker(loadImageFile);
  const outCanvasRef = useRef(null);
  const { exportPng } = useCanvasExport(outCanvasRef);
  const [processing, setProcessing] = useState(false);
  const params = state.params;
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  const drawResult = useCallback((result) => {
    const out = outCanvasRef.current;
    const pixels = previewOriginal && originalImage ? originalImage.pixels : result;
    const scale = Math.min(DISPLAY_MAX / pixels.width, DISPLAY_MAX / pixels.height, 1);

    out.width = pixels.width;
    out.height = pixels.height;
    out.style.width = `${Math.round(pixels.width * scale)}px`;
    out.style.height = `${Math.round(pixels.height * scale)}px`;
    putPixels(out, pixels);
    onCanvasReady?.(outCanvasRef);
  }, [originalImage, previewOriginal, onCanvasReady]);

  const runProcess = useCallback(() => {
    if (!image || !outCanvasRef.current) return;
    if (state.result && state.imageId === image.id && state.paramsKey === paramsKey) {
      drawResult(state.result);
      return;
    }

    setTimeout(() => {
      setProcessing(true);
      const result = decolorize(image.pixels, params);
      setDecolorize(s => ({ ...s, result, imageId: image.id, paramsKey }));
      drawResult(result);
      setProcessing(false);
    }, 0);
  }, [image, params, paramsKey, state.result, state.imageId, state.paramsKey, drawResult, setDecolorize]);

  useEffect(() => {
    if (image) runProcess();
  }, [image, runProcess]);

  const setParams = (fn) => {
    setDecolorize(s => ({ ...s, params: fn(s.params) }));
  };

  const applyResult = async () => {
    if (!state.result) return;
    const asset = await applyImageData(state.result, 'decolorize');
    setDecolorize(s => ({
      ...s,
      result: asset.pixels,
      imageId: asset.id,
      paramsKey: JSON.stringify(s.params),
    }));
  };

  const hasImage = !!image;
  const hasResult = !!state.result && state.imageId === image?.id;
  const imageHidden = !!layers.hidden.image;

  return (
    <div className="tool-wrapper">
      <div className="editor-shell">
        <section className="workspace">
          <div className="canvas-area">
          {!hasImage ? (
            <div
              className={`drop-zone${picker.isDragging ? ' drag-over' : ''}`}
              onDragOver={picker.onDragOver}
              onDragLeave={picker.onDragLeave}
              onDrop={picker.onDrop}
              onClick={picker.openPicker}
            >
              <Upload size={28} className="drop-zone-icon" />
              <div className="drop-zone-text">Drop an image here</div>
              <div className="drop-zone-hint">or click to browse</div>
            </div>
          ) : imageHidden ? (
            <div className="hidden-layer-state">Current image layer hidden</div>
          ) : (
            <CanvasViewport label="Current image">
              <div className="canvas-frame">
                <canvas ref={outCanvasRef} />
              </div>
            </CanvasViewport>
          )}
          </div>
        </section>

        <aside className="properties-panel">
          <div className="tool-heading">
            <div className="tool-title">Decolorize</div>
            <div className="tool-description">Remap luminance into a custom shade range with selective color preservation</div>
          </div>
          <div className="panel-actions">
            {processing && <span className="badge badge-processing">Processing...</span>}
            <button className="btn btn-secondary" onClick={picker.openPicker}>
              <Upload size={13} /> Load image
            </button>
            <button className="btn btn-primary" onClick={applyResult} disabled={!hasResult}>
              <Check size={13} /> Apply
            </button>
            <button className="btn btn-secondary" onClick={exportPng} disabled={!hasImage}>
              <Download size={13} /> Export
            </button>
          </div>

          <div className="control-group">
            <div className="control-group-label">Shade range</div>

            <div className="control-row">
              <label className="control-label">
                Darkest shade
                <span className="control-value">{params.darkest}</span>
              </label>
              <input
                type="range" min={0} max={254} step={1}
                value={params.darkest}
                onChange={e => setParams(p => ({ ...p, darkest: Math.min(+e.target.value, p.brightest - 1) }))}
              />
            </div>

            <div className="control-row">
              <label className="control-label">
                Brightest shade
                <span className="control-value">{params.brightest}</span>
              </label>
              <input
                type="range" min={1} max={255} step={1}
                value={params.brightest}
                onChange={e => setParams(p => ({ ...p, brightest: Math.max(+e.target.value, p.darkest + 1) }))}
              />
            </div>
          </div>

          <div className="control-group">
            <div className="control-group-label">Tone curve</div>

            <div className="control-row">
              <label className="control-label">
                Gamma
                <span className="control-value">{params.gamma.toFixed(2)}</span>
              </label>
              <input
                type="range" min={0.1} max={5} step={0.05}
                value={params.gamma}
                onChange={e => setParams(p => ({ ...p, gamma: parseFloat(e.target.value) }))}
              />
            </div>
          </div>

          <div className="control-group">
            <div className="control-group-label">Color preservation</div>

            <div className="control-row">
              <label className="control-label">
                Color threshold
                <span className="control-value">{params.colorThreshold.toFixed(2)}</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={params.colorThreshold}
                onChange={e => setParams(p => ({ ...p, colorThreshold: parseFloat(e.target.value) }))}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Pixels above this saturation keep their hue
              </div>
            </div>
          </div>

          <div className="divider" />

          <button className="btn btn-secondary btn-full" onClick={() => setParams(() => DECOLORIZE_DEFAULTS)}>
            <RefreshCw size={12} /> Reset defaults
          </button>
        </aside>

        <LayersStrip />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
    </div>
  );
}
