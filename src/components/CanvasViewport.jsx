import { useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 6;

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function isEditable(el) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName) || el?.isContentEditable;
}

export default function CanvasViewport({ label, children }) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !isEditable(e.target)) setSpaceDown(true);
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') setSpaceDown(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const zoomAt = (e, nextZoom) => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const vr = viewport.getBoundingClientRect();
    const cr = content.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    const lx = (e.clientX - cx) / zoom;
    const ly = (e.clientY - cy) / zoom;

    setZoom(nextZoom);
    setPan({
      x: e.clientX - (vr.left + vr.width / 2) - lx * nextZoom,
      y: e.clientY - (vr.top + vr.height / 2) - ly * nextZoom,
    });
  };

  const fit = () => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const nextZoom = clampZoom(Math.min(
      (viewport.clientWidth - 40) / content.offsetWidth,
      (viewport.clientHeight - 64) / content.offsetHeight,
      1,
    ));
    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
  };

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(e, clampZoom(zoom * factor));
  };

  const onMouseDownCapture = (e) => {
    if (e.button !== 1 && !spaceDown) return;

    e.preventDefault();
    e.stopPropagation();
    setPanning({ x: e.clientX, y: e.clientY, pan });
  };

  const onMouseMoveCapture = (e) => {
    if (!panning) return;

    e.preventDefault();
    e.stopPropagation();
    setPan({
      x: panning.pan.x + e.clientX - panning.x,
      y: panning.pan.y + e.clientY - panning.y,
    });
  };

  const stopPanning = (e) => {
    if (!panning) return;
    e.preventDefault();
    e.stopPropagation();
    setPanning(null);
  };

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport${spaceDown || panning ? ' can-pan' : ''}${panning ? ' panning' : ''}`}
      onWheel={onWheel}
      onMouseDownCapture={onMouseDownCapture}
      onMouseMoveCapture={onMouseMoveCapture}
      onMouseUpCapture={stopPanning}
      onMouseLeave={stopPanning}
      onAuxClick={e => e.preventDefault()}
    >
      <div
        ref={contentRef}
        className="canvas-view-content"
        style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}
      >
        <div className="canvas-slot">
          <div className="canvas-label">{label}</div>
          {children}
        </div>
      </div>
      <div className="canvas-zoom-controls">
        <button type="button" onClick={fit}>Fit</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={reset}>100%</button>
      </div>
    </div>
  );
}
