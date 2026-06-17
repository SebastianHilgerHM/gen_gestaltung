import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, Download, Check, Plus, Trash2, Link2, Unlink } from 'lucide-react';
import CanvasViewport from '../../components/CanvasViewport.jsx';
import LayersStrip from '../../components/LayersStrip.jsx';
import { useFilePicker } from '../../hooks/useFilePicker.js';
import { useCanvasExport } from '../../hooks/useCanvasExport.js';
import { putPixels } from '../../utils/imageData.js';
import { usePictureplane } from '../../state/pictureplaneState.js';
import { detectQuadFromImage } from './detectQuad.js';
import { warpAndComposite } from './warp.js';

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay'];
const DISPLAY_MAX = 700;
const LABELS = ['TL', 'TR', 'BR', 'BL'];
const EDGES = [
  { label: 'Top', corners: [0, 1] },
  { label: 'Right', corners: [1, 2] },
  { label: 'Bottom', corners: [2, 3] },
  { label: 'Left', corners: [3, 0] },
];

function planeLayerId(id) {
  return `plane:${id}`;
}

function idFromLayer(layerId) {
  return Number(layerId.split(':')[1]);
}

function makePlane(id, canvas, index) {
  const inset = 0.18 + (index % 3) * 0.05;
  const size = 0.38;
  const x = canvas.width * inset;
  const y = canvas.height * inset;
  const w = canvas.width * size;
  const h = canvas.height * size;

  return {
    id,
    name: `Plane ${id}`,
    mode: 'manual',
    quad: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
  };
}

function clampPoint([x, y], canvas) {
  return [
    Math.max(0, Math.min(canvas.width, x)),
    Math.max(0, Math.min(canvas.height, y)),
  ];
}

function edgeCorner(edge, pos, reverse) {
  return EDGES[edge].corners[reverse ? 1 - pos : pos];
}

function linkedCorners(connections, planeId, corner) {
  const seen = new Set([`${planeId}:${corner}`]);
  const queue = [{ planeId, corner }];

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];

    connections.forEach(conn => {
      [
        [conn.a, conn.b, false],
        [conn.b, conn.a, true],
      ].forEach(([from, to]) => {
        if (from.planeId !== current.planeId) return;

        const pos = EDGES[from.edge].corners.indexOf(current.corner);
        if (pos < 0) return;

        const next = {
          planeId: to.planeId,
          corner: edgeCorner(to.edge, pos, conn.reverse),
        };
        const key = `${next.planeId}:${next.corner}`;
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      });
    });
  }

  return queue;
}

export default function QuadMapper({ onCanvasReady }) {
  const {
    image,
    originalImage,
    previewOriginal,
    artwork,
    layers,
    quadMapper: state,
    loadImageFile,
    loadArtworkFile,
    applyImageData,
    setQuadMapper,
    addLayer,
    removeLayer,
    selectLayer,
  } = usePictureplane();
  const {
    inputRef: bgInputRef,
    onInputChange: onBgInputChange,
    ...bgPicker
  } = useFilePicker(loadImageFile);
  const {
    inputRef: artInputRef,
    onInputChange: onArtInputChange,
    ...artPicker
  } = useFilePicker(loadArtworkFile);
  const canvasRef = useRef(null);
  const exportCanvasRef = useRef(null);
  const scaleRef = useRef(1);
  const { exportPng } = useCanvasExport(exportCanvasRef);
  const [dragging, setDragging] = useState(null);
  const [detecting, setDetecting] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [connectionDraft, setConnectionDraft] = useState({
    aPlaneId: '',
    aEdge: 1,
    bPlaneId: '',
    bEdge: 3,
    reverse: true,
  });
  const { planes, selectedPlaneId, connections, opacity, blendMode } = state;
  const displayImage = previewOriginal && originalImage ? originalImage : image;
  const selectedPlane = planes.find(plane => plane.id === selectedPlaneId) ?? planes[0];
  const selectedLayerId = selectedPlane ? planeLayerId(selectedPlane.id) : null;
  const planesById = useMemo(
    () => new Map(planes.map(plane => [plane.id, plane])),
    [planes],
  );

  const drawExport = useCallback((pixels) => {
    if (!exportCanvasRef.current) return;

    const canvas = exportCanvasRef.current;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    putPixels(canvas, pixels);
    onCanvasReady?.(exportCanvasRef);
  }, [onCanvasReady]);

  useEffect(() => {
    if (image) drawExport(image.pixels);
  }, [image, drawExport]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const scale = Math.min(DISPLAY_MAX / image.width, DISPLAY_MAX / image.height, 1);
    scaleRef.current = scale;
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
  }, [image]);

  useEffect(() => {
    if (!image || !canvasRef.current || planes.length > 0) return;

    const id = state.nextPlaneId;
    const plane = makePlane(id, canvasRef.current, 0);
    addLayer(planeLayerId(id));
    setQuadMapper(s => ({
      ...s,
      imageId: image.id,
      selectedPlaneId: id,
      nextPlaneId: id + 1,
      planes: [plane],
    }));
  }, [image, planes.length, state.nextPlaneId, addLayer, setQuadMapper]);

  useEffect(() => {
    if (!layers.selected.startsWith('plane:')) return;

    const id = idFromLayer(layers.selected);
    if (planesById.has(id) && selectedPlaneId !== id) {
      setQuadMapper(s => ({ ...s, selectedPlaneId: id }));
    }
  }, [layers.selected, planesById, selectedPlaneId, setQuadMapper]);

  useEffect(() => {
    if (!selectedLayerId || layers.selected === selectedLayerId) return;
    selectLayer(selectedLayerId);
  }, [selectedLayerId, layers.selected, selectLayer]);

  const drawPlane = useCallback((ctx, plane) => {
    const active = plane.id === selectedPlane?.id;
    ctx.beginPath();
    ctx.moveTo(plane.quad[0][0], plane.quad[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(plane.quad[i][0], plane.quad[i][1]);
    ctx.closePath();
    ctx.strokeStyle = active ? 'rgba(108,143,255,0.95)' : 'rgba(154,160,168,0.75)';
    ctx.lineWidth = active ? 2 : 1.25;
    ctx.stroke();
    ctx.fillStyle = active ? 'rgba(108,143,255,0.08)' : 'rgba(154,160,168,0.05)';
    ctx.fill();

    connections.forEach(conn => {
      [conn.a, conn.b].forEach(side => {
        if (side.planeId !== plane.id) return;
        const [a, b] = EDGES[side.edge].corners;
        ctx.beginPath();
        ctx.moveTo(plane.quad[a][0], plane.quad[a][1]);
        ctx.lineTo(plane.quad[b][0], plane.quad[b][1]);
        ctx.strokeStyle = 'rgba(74,222,128,0.95)';
        ctx.lineWidth = 4;
        ctx.stroke();
      });
    });

    plane.quad.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, active ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = active ? '#6c8fff' : '#9aa0a8';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = active ? '#6c8fff' : '#9aa0a8';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(LABELS[i], x, y - 10);
    });
  }, [connections, selectedPlane?.id]);

  const drawCanvas = useCallback(() => {
    if (!displayImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    layers.order.forEach(id => {
      if (layers.hidden[id]) return;

      if (id === 'image') {
        ctx.drawImage(displayImage.img, 0, 0, canvas.width, canvas.height);
      }

      if (id.startsWith('plane:')) {
        const plane = planesById.get(idFromLayer(id));
        if (plane) drawPlane(ctx, plane);
      }
    });

    if (detecting) {
      const x = Math.min(detecting.start[0], detecting.current[0]);
      const y = Math.min(detecting.start[1], detecting.current[1]);
      const w = Math.abs(detecting.current[0] - detecting.start[0]);
      const h = Math.abs(detecting.current[1] - detecting.start[1]);
      ctx.save();
      ctx.strokeStyle = 'rgba(251,146,60,0.95)';
      ctx.fillStyle = 'rgba(251,146,60,0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
  }, [displayImage, layers.hidden, layers.order, planesById, drawPlane, detecting]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return [
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top) * sy,
    ];
  };

  const selectPlane = (id) => {
    setQuadMapper(s => ({ ...s, selectedPlaneId: id }));
    selectLayer(planeLayerId(id));
  };

  const addPlane = () => {
    if (!canvasRef.current) return;

    const id = state.nextPlaneId;
    const plane = makePlane(id, canvasRef.current, planes.length);
    addLayer(planeLayerId(id));
    setQuadMapper(s => ({
      ...s,
      selectedPlaneId: id,
      nextPlaneId: id + 1,
      planes: [...s.planes, plane],
    }));
  };

  const deletePlane = (id) => {
    removeLayer(planeLayerId(id));
    setQuadMapper(s => {
      const planes = s.planes.filter(plane => plane.id !== id);
      return {
        ...s,
        planes,
        selectedPlaneId: planes[0]?.id ?? null,
        connections: s.connections.filter(conn => conn.a.planeId !== id && conn.b.planeId !== id),
      };
    });
  };

  const setSelectedPlaneMode = (mode) => {
    if (!selectedPlane) return;

    setQuadMapper(s => ({
      ...s,
      planes: s.planes.map(plane => (
        plane.id === selectedPlane.id ? { ...plane, mode } : plane
      )),
    }));
  };

  const addConnection = () => {
    const aPlaneId = Number(connectionDraft.aPlaneId || selectedPlane?.id);
    const bPlaneId = Number(connectionDraft.bPlaneId || planes.find(plane => plane.id !== aPlaneId)?.id);

    if (!aPlaneId || !bPlaneId || aPlaneId === bPlaneId) return;

    setQuadMapper(s => ({
      ...s,
      connections: [
        ...s.connections,
        {
          id: Date.now(),
          a: { planeId: aPlaneId, edge: Number(connectionDraft.aEdge) },
          b: { planeId: bPlaneId, edge: Number(connectionDraft.bEdge) },
          reverse: connectionDraft.reverse,
        },
      ],
    }));
  };

  const removeConnection = (id) => {
    setQuadMapper(s => ({
      ...s,
      connections: s.connections.filter(conn => conn.id !== id),
    }));
  };

  const onMouseDown = (e) => {
    const [mx, my] = getCanvasPos(e);
    let best = null;

    layers.order.forEach(layerId => {
      if (!layerId.startsWith('plane:') || layers.hidden[layerId]) return;
      const plane = planesById.get(idFromLayer(layerId));
      if (!plane) return;

      plane.quad.forEach(([x, y], corner) => {
        const dist = Math.hypot(mx - x, my - y);
        if (dist < 14 && (!best || dist < best.dist)) {
          best = { planeId: plane.id, corner, dist };
        }
      });
    });

    if (!best) {
      if (selectedPlane?.mode === 'auto') {
        setDetecting({ planeId: selectedPlane.id, start: [mx, my], current: [mx, my] });
      }
      return;
    }

    selectPlane(best.planeId);
    setDragging({ ...best, lastX: mx, lastY: my });
  };

  const onMouseMove = (e) => {
    if (detecting) {
      const current = getCanvasPos(e);
      setDetecting(d => ({ ...d, current }));
      return;
    }

    if (!dragging) return;

    const canvas = canvasRef.current;
    const [x, y] = getCanvasPos(e);
    const dx = x - dragging.lastX;
    const dy = y - dragging.lastY;
    const linked = linkedCorners(connections, dragging.planeId, dragging.corner);
    const keys = new Set(linked.map(({ planeId, corner }) => `${planeId}:${corner}`));

    setQuadMapper(s => ({
      ...s,
      planes: s.planes.map(plane => ({
        ...plane,
        quad: plane.quad.map((pt, corner) => (
          keys.has(`${plane.id}:${corner}`)
            ? clampPoint([pt[0] + dx, pt[1] + dy], canvas)
            : pt
        )),
      })),
    }));
    setDragging(d => ({ ...d, lastX: x, lastY: y }));
  };

  const onMouseUp = () => {
    if (detecting && displayImage && canvasRef.current) {
      const quad = detectQuadFromImage(
        displayImage.img,
        { width: canvasRef.current.width, height: canvasRef.current.height },
        detecting.start,
        detecting.current,
      );
      setQuadMapper(s => ({
        ...s,
        planes: s.planes.map(plane => (
          plane.id === detecting.planeId ? { ...plane, quad } : plane
        )),
      }));
      setDetecting(null);
    }

    setDragging(null);
  };

  const handleComposite = useCallback(() => {
    if (!image || !artwork || planes.length === 0) return;

    setProcessing(true);
    setTimeout(async () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = image.width;
      offscreen.height = image.height;
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(image.img, 0, 0);

      const scale = 1 / scaleRef.current;
      layers.order.forEach(layerId => {
        if (!layerId.startsWith('plane:') || layers.hidden[layerId]) return;

        const plane = planesById.get(idFromLayer(layerId));
        if (!plane) return;

        const naturalQuad = plane.quad.map(([x, y]) => [x * scale, y * scale]);
        const pixels = warpAndComposite(offscreen, artwork.img, naturalQuad, opacity, blendMode);
        putPixels(offscreen, pixels);
      });

      const pixels = ctx.getImageData(0, 0, image.width, image.height);
      const asset = await applyImageData(pixels, 'quad-mapper');
      drawExport(asset.pixels);
      setQuadMapper(s => ({ ...s, imageId: asset.id }));
      setProcessing(false);
    }, 0);
  }, [
    image,
    artwork,
    planes.length,
    layers.order,
    layers.hidden,
    planesById,
    opacity,
    blendMode,
    applyImageData,
    drawExport,
    setQuadMapper,
  ]);

  const hasImage = !!image;
  const hasArt = !!artwork;
  const canComposite = !!(hasImage && hasArt && planes.length > 0);
  const selectablePlanes = planes.length > 1 ? planes.filter(plane => plane.id !== Number(connectionDraft.aPlaneId || selectedPlane?.id)) : [];

  return (
    <div className="tool-wrapper">
      <div className="editor-shell">
        <section className="workspace">
          <div className="canvas-area">
          {!hasImage ? (
            <div
              className={`drop-zone${bgPicker.isDragging ? ' drag-over' : ''}`}
              onDragOver={bgPicker.onDragOver}
              onDragLeave={bgPicker.onDragLeave}
              onDrop={bgPicker.onDrop}
              onClick={bgPicker.openPicker}
            >
              <Upload size={28} className="drop-zone-icon" />
              <div className="drop-zone-text">Drop an image</div>
              <div className="drop-zone-hint">or click to browse</div>
            </div>
          ) : (
            <CanvasViewport label={selectedPlane?.name ?? 'Current image'}>
              <div
                className="canvas-frame"
                style={{ cursor: dragging ? 'grabbing' : 'default' }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                />
              </div>
            </CanvasViewport>
          )}
          <canvas ref={exportCanvasRef} style={{ display: 'none' }} />
          </div>
        </section>

        <aside className="properties-panel">
          <div className="tool-heading">
            <div className="tool-title">Quad Mapper</div>
            <div className="tool-description">Map artwork onto multiple connected perspective planes</div>
          </div>
          <div className="panel-actions">
            {processing && <span className="badge badge-processing">Warping...</span>}
            {detecting && <span className="badge badge-processing">Detecting...</span>}
            <button className="btn btn-primary" onClick={handleComposite} disabled={!canComposite || processing}>
              <Check size={13} /> Apply warp
            </button>
            <button className="btn btn-secondary" onClick={exportPng} disabled={!hasImage}>
              <Download size={13} /> Export
            </button>
          </div>

          <div className="control-group">
            <div className="control-group-label">Current image</div>
            {hasImage
              ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {image.width} x {image.height}px
                  <button className="btn btn-ghost btn-full" style={{ marginTop: 6 }} onClick={bgPicker.openPicker}>
                    <Upload size={12} /> Change
                  </button>
                </div>
              : <button className="btn btn-secondary btn-full" onClick={bgPicker.openPicker}>
                  <Upload size={13} /> Load image
                </button>
            }
          </div>

          <div className="control-group">
            <div className="control-group-label">Artwork</div>
            {hasArt
              ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {artwork.width} x {artwork.height}px
                  <button className="btn btn-ghost btn-full" style={{ marginTop: 6 }} onClick={artPicker.openPicker}>
                    <Upload size={12} /> Change
                  </button>
                </div>
              : <button className="btn btn-secondary btn-full" onClick={artPicker.openPicker} disabled={!hasImage}>
                  <Upload size={13} /> Load artwork
                </button>
            }
          </div>

          <div className="divider" />

          <div className="control-group">
            <div className="control-group-label">Planes</div>
            <button className="btn btn-secondary btn-full" onClick={addPlane} disabled={!hasImage}>
              <Plus size={13} /> Add plane
            </button>
            {planes.map(plane => (
              <div key={plane.id} className={`plane-row${plane.id === selectedPlane?.id ? ' active' : ''}`}>
                <button className="plane-select" onClick={() => selectPlane(plane.id)}>{plane.name}</button>
                <button className="icon-btn" onClick={() => deletePlane(plane.id)} title="Delete plane">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {selectedPlane && (
              <div className="control-row">
                <label className="control-label">Mode</label>
                <div className="segmented">
                  <button
                    className={selectedPlane.mode !== 'auto' ? 'active' : ''}
                    onClick={() => setSelectedPlaneMode('manual')}
                  >
                    Manual
                  </button>
                  <button
                    className={selectedPlane.mode === 'auto' ? 'active' : ''}
                    onClick={() => setSelectedPlaneMode('auto')}
                  >
                    Auto-detect
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="control-group">
            <div className="control-group-label">Connections</div>
            <div className="control-row">
              <label className="control-label">Plane A</label>
              <select
                value={connectionDraft.aPlaneId || selectedPlane?.id || ''}
                onChange={e => setConnectionDraft(d => ({ ...d, aPlaneId: e.target.value }))}
              >
                {planes.map(plane => <option key={plane.id} value={plane.id}>{plane.name}</option>)}
              </select>
            </div>
            <div className="control-row">
              <label className="control-label">Edge A</label>
              <select
                value={connectionDraft.aEdge}
                onChange={e => setConnectionDraft(d => ({ ...d, aEdge: Number(e.target.value) }))}
              >
                {EDGES.map((edge, i) => <option key={edge.label} value={i}>{edge.label}</option>)}
              </select>
            </div>
            <div className="control-row">
              <label className="control-label">Plane B</label>
              <select
                value={connectionDraft.bPlaneId || selectablePlanes[0]?.id || ''}
                onChange={e => setConnectionDraft(d => ({ ...d, bPlaneId: e.target.value }))}
              >
                <option value="">Select plane</option>
                {selectablePlanes.map(plane => <option key={plane.id} value={plane.id}>{plane.name}</option>)}
              </select>
            </div>
            <div className="control-row">
              <label className="control-label">Edge B</label>
              <select
                value={connectionDraft.bEdge}
                onChange={e => setConnectionDraft(d => ({ ...d, bEdge: Number(e.target.value) }))}
              >
                {EDGES.map((edge, i) => <option key={edge.label} value={i}>{edge.label}</option>)}
              </select>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={connectionDraft.reverse}
                onChange={e => setConnectionDraft(d => ({ ...d, reverse: e.target.checked }))}
              />
              Reverse endpoints
            </label>
            <button className="btn btn-secondary btn-full" onClick={addConnection} disabled={planes.length < 2}>
              <Link2 size={13} /> Connect edges
            </button>
            {connections.map(conn => {
              const a = planesById.get(conn.a.planeId);
              const b = planesById.get(conn.b.planeId);

              return (
                <div key={conn.id} className="connection-row">
                  <span>{a?.name} {EDGES[conn.a.edge].label} - {b?.name} {EDGES[conn.b.edge].label}</span>
                  <button className="icon-btn" onClick={() => removeConnection(conn.id)} title="Remove connection">
                    <Unlink size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="divider" />

          <div className="control-group">
            <div className="control-group-label">Composite</div>

            <div className="control-row">
              <label className="control-label">
                Opacity
                <span className="control-value">{Math.round(opacity * 100)}%</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={opacity}
                onChange={e => setQuadMapper(s => ({ ...s, opacity: parseFloat(e.target.value) }))}
              />
            </div>

            <div className="control-row">
              <label className="control-label">Blend mode</label>
              <select value={blendMode} onChange={e => setQuadMapper(s => ({ ...s, blendMode: e.target.value }))}>
                {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </aside>

        <LayersStrip />
      </div>

      <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onBgInputChange} />
      <input ref={artInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onArtInputChange} />
    </div>
  );
}
