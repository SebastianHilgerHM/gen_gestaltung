import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, Download } from 'lucide-react';
import CanvasViewport from '../../components/CanvasViewport.jsx';
import LayersStrip from '../../components/LayersStrip.jsx';
import { useFilePicker } from '../../hooks/useFilePicker.js';
import { putPixels } from '../../utils/imageData.js';
import {
  PLACER_DEFAULTS,
  usePictureplane,
} from '../../state/pictureplaneState.js';
import { warpAndComposite } from '../QuadMapper/warp.js';

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay'];
const DISPLAY_MAX = 700;
const EDGES = [
  { corners: [0, 1], delta: [0, -1] },
  { corners: [1, 2], delta: [1, 0] },
  { corners: [2, 3], delta: [0, 1] },
  { corners: [3, 0], delta: [-1, 0] },
];

function planeLayerId(id) {
  return `plane:${id}`;
}

function idFromLayer(layerId) {
  return Number(layerId.split(':')[1]);
}

function groupId(ids) {
  return `group:${ids.join(',')}`;
}

function connectedGroups(planes, connections) {
  const ids = new Set(planes.map(plane => plane.id));
  const seen = new Set();
  const graph = new Map(planes.map(plane => [plane.id, []]));

  connections.forEach(conn => {
    if (!ids.has(conn.a.planeId) || !ids.has(conn.b.planeId)) return;
    graph.get(conn.a.planeId).push(conn.b.planeId);
    graph.get(conn.b.planeId).push(conn.a.planeId);
  });

  return planes
    .map(plane => plane.id)
    .filter(id => !seen.has(id))
    .map(id => {
      const queue = [id];
      const group = [];
      seen.add(id);

      for (let i = 0; i < queue.length; i++) {
        const current = queue[i];
        group.push(current);
        graph.get(current).forEach(next => {
          if (seen.has(next)) return;
          seen.add(next);
          queue.push(next);
        });
      }

      return group;
    })
    .filter(group => group.length > 1);
}

function buildTargets(planes, connections) {
  const groups = connectedGroups(planes, connections);

  return [
    { id: 'free', type: 'free', label: 'Free placement', planeIds: [] },
    ...planes.map(plane => ({
      id: planeLayerId(plane.id),
      type: 'plane',
      label: plane.name,
      planeIds: [plane.id],
    })),
    ...groups.map(ids => ({
      id: groupId(ids),
      type: 'group',
      label: ids.map(id => planes.find(plane => plane.id === id)?.name).join(' + '),
      planeIds: ids,
    })),
  ];
}

function groupTiles(planeIds, connections) {
  const set = new Set(planeIds);
  const tiles = new Map([[planeIds[0], [0, 0]]]);
  const queue = [planeIds[0]];

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const tile = tiles.get(id);

    connections.forEach(conn => {
      [
        [conn.a, conn.b],
        [conn.b, conn.a],
      ].forEach(([from, to]) => {
        if (from.planeId !== id || !set.has(to.planeId) || tiles.has(to.planeId)) return;

        const [dx, dy] = EDGES[from.edge].delta;
        tiles.set(to.planeId, [tile[0] + dx, tile[1] + dy]);
        queue.push(to.planeId);
      });
    });
  }

  planeIds.forEach(id => {
    if (!tiles.has(id)) tiles.set(id, [tiles.size, 0]);
  });

  return tiles;
}

function sourceRects(target, artwork, connections) {
  if (target.type !== 'group') {
    return new Map(target.planeIds.map(id => [id, null]));
  }

  const tiles = groupTiles(target.planeIds, connections);
  const points = [...tiles.values()];
  const minX = Math.min(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1]));
  const maxX = Math.max(...points.map(p => p[0]));
  const maxY = Math.max(...points.map(p => p[1]));
  const width = artwork.width / (maxX - minX + 1);
  const height = artwork.height / (maxY - minY + 1);

  return new Map([...tiles].map(([id, [x, y]]) => [
    id,
    {
      x: (x - minX) * width,
      y: (y - minY) * height,
      width,
      height,
    },
  ]));
}

export default function ArtworkPlacer({ onCanvasReady }) {
  const {
    image,
    originalImage,
    previewOriginal,
    artwork,
    layers,
    quadMapper,
    artworkPlacer: state,
    loadImageFile,
    loadArtworkFile,
    applyImageData,
    setArtworkPlacer,
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
  const outCanvasRef = useRef(null);
  const scaleRef = useRef(1);
  const [interaction, setInteraction] = useState(null);
  const transform = state.transform;
  const displayImage = previewOriginal && originalImage ? originalImage : image;
  const planesById = useMemo(
    () => new Map(quadMapper.planes.map(plane => [plane.id, plane])),
    [quadMapper.planes],
  );
  const targets = useMemo(
    () => buildTargets(quadMapper.planes, quadMapper.connections),
    [quadMapper.planes, quadMapper.connections],
  );
  const target = targets.find(item => item.id === (state.targetId ?? 'free')) ?? targets[0];
  const isFree = target.type === 'free';

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const scale = Math.min(DISPLAY_MAX / image.width, DISPLAY_MAX / image.height, 1);
    scaleRef.current = scale;
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    if (state.imageId === image.id) return;

    setArtworkPlacer(s => ({
      ...s,
      imageId: image.id,
      result: null,
      transform: {
        ...s.transform,
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: Math.min(canvas.width * 0.5, PLACER_DEFAULTS.width),
        height: Math.min(canvas.height * 0.5, PLACER_DEFAULTS.height),
      },
    }));
  }, [image, state.imageId, setArtworkPlacer]);

  useEffect(() => {
    if (!image || !artwork || !canvasRef.current || state.artworkId === artwork.id) return;

    const canvas = canvasRef.current;
    const width = Math.min(canvas.width * 0.6, artwork.width * scaleRef.current);
    const height = width * (artwork.height / artwork.width);
    setArtworkPlacer(s => ({
      ...s,
      artworkId: artwork.id,
      transform: { ...s.transform, width, height },
    }));
  }, [image, artwork, state.artworkId, setArtworkPlacer]);

  const composeArtwork = useCallback((canvas, target, scale = 1) => {
    if (!artwork || !target || layers.hidden.artwork) return;

    const ctx = canvas.getContext('2d');

    if (target.type === 'free') {
      const { x, y, width, height, rotation, opacity, blendMode } = transform;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode === 'normal' ? 'source-over' : blendMode;
      ctx.translate(x * scale, y * scale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(artwork.img, -width * scale / 2, -height * scale / 2, width * scale, height * scale);
      ctx.restore();
      return;
    }

    const rects = sourceRects(target, artwork, quadMapper.connections);

    layers.order.forEach(layerId => {
      if (!layerId.startsWith('plane:') || layers.hidden[layerId]) return;

      const id = idFromLayer(layerId);
      if (!target.planeIds.includes(id)) return;

      const plane = planesById.get(id);
      if (!plane) return;

      const quad = plane.quad.map(([x, y, u, v]) => [x * scale, y * scale, u, v]);
      const pixels = warpAndComposite(
        canvas,
        artwork.img,
        quad,
        transform.opacity,
        transform.blendMode,
        rects.get(id),
      );
      putPixels(canvas, pixels);
    });
  }, [
    artwork,
    transform,
    layers.hidden,
    layers.order,
    quadMapper.connections,
    planesById,
  ]);

  const drawTargetOutlines = useCallback((ctx) => {
    if (target.type === 'free') return;

    target.planeIds.forEach(id => {
      const plane = planesById.get(id);
      if (!plane || layers.hidden[planeLayerId(id)]) return;

      ctx.beginPath();
      ctx.moveTo(plane.quad[0][0], plane.quad[0][1]);
      for (let i = 1; i < plane.quad.length; i++) ctx.lineTo(plane.quad[i][0], plane.quad[i][1]);
      ctx.closePath();
      ctx.strokeStyle = target.type === 'group' ? 'rgba(74,222,128,0.95)' : 'rgba(108,143,255,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }, [target, planesById, layers.hidden]);

  const redraw = useCallback(() => {
    if (!displayImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    layers.order.forEach(id => {
      if (layers.hidden[id]) return;

      if (id === 'image') {
        ctx.drawImage(displayImage.img, 0, 0, canvas.width, canvas.height);
      }

      if (id === 'artwork' && artwork) {
        composeArtwork(canvas, target);
      }
    });

    drawTargetOutlines(ctx);

    if (!artwork || layers.hidden.artwork || !isFree) return;

    const { x, y, width, height, rotation } = transform;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.strokeStyle = 'rgba(108,143,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    ctx.setLineDash([]);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#6c8fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [
    displayImage,
    artwork,
    transform,
    layers.hidden,
    layers.order,
    composeArtwork,
    drawTargetOutlines,
    target,
    isFree,
  ]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCompositePixels = useCallback(() => {
    if (!image) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = image.width;
    offscreen.height = image.height;
    const ctx = offscreen.getContext('2d');
    const scale = 1 / scaleRef.current;

    layers.order.forEach(id => {
      if (layers.hidden[id]) return;

      if (id === 'image') {
        ctx.drawImage(image.img, 0, 0);
      }

      if (id === 'artwork' && artwork) {
        composeArtwork(offscreen, target, scale);
      }
    });

    return ctx.getImageData(0, 0, image.width, image.height);
  }, [image, artwork, layers.hidden, layers.order, composeArtwork, target]);

  const drawExport = useCallback((pixels) => {
    if (!pixels || !outCanvasRef.current) return;

    const out = outCanvasRef.current;
    out.width = pixels.width;
    out.height = pixels.height;
    putPixels(out, pixels);
    onCanvasReady?.(outCanvasRef);
  }, [onCanvasReady]);

  useEffect(() => {
    drawExport(getCompositePixels());
  }, [getCompositePixels, drawExport]);

  const setTransform = (fn) => {
    setArtworkPlacer(s => ({ ...s, transform: fn(s.transform) }));
  };

  const setTargetId = (targetId) => {
    setArtworkPlacer(s => ({ ...s, targetId }));
  };

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return [(e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy];
  };

  const rotatedLocal = (x, y) => {
    const rad = -(transform.rotation * Math.PI) / 180;
    const dx = x - transform.x;
    const dy = y - transform.y;
    return [
      dx * Math.cos(rad) - dy * Math.sin(rad),
      dx * Math.sin(rad) + dy * Math.cos(rad),
    ];
  };

  const onMouseDown = (e) => {
    if (!artwork || !isFree) return;

    const [x, y] = getCanvasPos(e);
    const [lx, ly] = rotatedLocal(x, y);
    const hw = transform.width / 2;
    const hh = transform.height / 2;

    if (Math.hypot(lx - hw, ly - hh) < 12) {
      setInteraction({ type: 'resize', startX: x, startY: y, startT: { ...transform } });
    } else if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
      setInteraction({ type: 'move', startX: x, startY: y, startT: { ...transform } });
    }
  };

  const onMouseMove = (e) => {
    if (!interaction || !isFree) return;

    const [x, y] = getCanvasPos(e);
    const dx = x - interaction.startX;
    const dy = y - interaction.startY;

    if (interaction.type === 'move') {
      setTransform(t => ({ ...t, x: interaction.startT.x + dx, y: interaction.startT.y + dy }));
    } else {
      const width = Math.max(20, interaction.startT.width + dx * 2);
      const aspect = interaction.startT.height / interaction.startT.width;
      setTransform(t => ({ ...t, width, height: width * aspect }));
    }
  };

  const onMouseUp = () => setInteraction(null);

  const handleExport = useCallback(async () => {
    if (!image || !artwork) return;

    const pixels = getCompositePixels();
    const out = outCanvasRef.current;
    drawExport(pixels);

    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pictureplane-export.png';
    a.click();

    const asset = await applyImageData(pixels, 'artwork-placer');
    setArtworkPlacer(s => ({ ...s, imageId: asset.id, result: pixels }));
  }, [
    image,
    artwork,
    getCompositePixels,
    drawExport,
    applyImageData,
    setArtworkPlacer,
  ]);

  const hasImage = !!image;
  const hasArt = !!artwork;
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
            <CanvasViewport
              label={hasArt
                ? isFree ? 'Free placement' : target.label
                : 'Load artwork to begin'}
            >
              <div
                className="canvas-frame"
                style={{ cursor: interaction?.type === 'move' ? 'grabbing' : 'default' }}
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
          <canvas ref={outCanvasRef} style={{ display: 'none' }} />
          </div>
        </section>

        <aside className="properties-panel">
          <div className="tool-heading">
            <div className="tool-title">Artwork Placer</div>
            <div className="tool-description">Place artwork freely or project it onto Quad Mapper planes</div>
          </div>
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={handleExport} disabled={!hasImage || !hasArt}>
              <Download size={13} /> Export full res
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
            <div className="control-group-label">Target</div>
            <div className="control-row">
              <label className="control-label">Placement</label>
              <select value={target.id} onChange={e => setTargetId(e.target.value)}>
                {targets.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            {!quadMapper.planes.length && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Quad Mapper planes appear here after you create them.
              </div>
            )}
          </div>

          {isFree && (
            <div className="control-group">
              <div className="control-group-label">Transform</div>

              <div className="control-row">
                <label className="control-label">
                  Rotation
                  <span className="control-value">{transform.rotation}deg</span>
                </label>
                <input
                  type="range" min={-180} max={180} step={1}
                  value={transform.rotation}
                  onChange={e => setTransform(t => ({ ...t, rotation: +e.target.value }))}
                />
              </div>

              <div className="control-row">
                <label className="control-label">X position</label>
                <input
                  type="number"
                  value={Math.round(transform.x)}
                  onChange={e => setTransform(t => ({ ...t, x: +e.target.value }))}
                />
              </div>

              <div className="control-row">
                <label className="control-label">Y position</label>
                <input
                  type="number"
                  value={Math.round(transform.y)}
                  onChange={e => setTransform(t => ({ ...t, y: +e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="control-group">
            <div className="control-group-label">Composite</div>

            <div className="control-row">
              <label className="control-label">
                Opacity
                <span className="control-value">{Math.round(transform.opacity * 100)}%</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={transform.opacity}
                onChange={e => setTransform(t => ({ ...t, opacity: +e.target.value }))}
              />
            </div>

            <div className="control-row">
              <label className="control-label">Blend mode</label>
              <select value={transform.blendMode} onChange={e => setTransform(t => ({ ...t, blendMode: e.target.value }))}>
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
