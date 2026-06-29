import { putPixels } from './imageData.js';
import { warpAndComposite } from '../tools/QuadMapper/warp.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function planeLayerId(id) {
  return `plane:${id}`;
}

export function artworkLayerId(id) {
  return `artwork:${id}`;
}

export function idFromPlaneLayer(layerId) {
  return Number(layerId.split(':')[1]);
}

export function idFromArtworkLayer(layerId) {
  return Number(layerId.split(':')[1]);
}

export function connectedGroups(planes, connections) {
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

export function groupId(ids) {
  return `group:${ids.join(',')}`;
}

export function buildTargets(planes, connections) {
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

export function targetPlaneIds(targetId, planes, connections) {
  if (targetId === 'free') return [];
  if (targetId.startsWith('plane:')) return [idFromPlaneLayer(targetId)];
  if (targetId.startsWith('group:')) {
    return targetId.slice(6).split(',').map(Number).filter(id => planes.some(plane => plane.id === id));
  }
  return buildTargets(planes, connections).find(target => target.id === targetId)?.planeIds ?? [];
}

function barycentric(p, a, b, c) {
  const v0 = [b[0] - a[0], b[1] - a[1]];
  const v1 = [c[0] - a[0], c[1] - a[1]];
  const v2 = [p[0] - a[0], p[1] - a[1]];
  const d00 = v0[0] * v0[0] + v0[1] * v0[1];
  const d01 = v0[0] * v1[0] + v0[1] * v1[1];
  const d11 = v1[0] * v1[0] + v1[1] * v1[1];
  const d20 = v2[0] * v0[0] + v2[1] * v0[1];
  const d21 = v2[0] * v1[0] + v2[1] * v1[1];
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 0.000001) return null;

  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  return [1 - v - w, v, w];
}

export function pointInPoly(x, y, points) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }

  return inside;
}

function uvCenter(plane) {
  return plane.quad.reduce((sum, p) => [
    sum[0] + p[0],
    sum[1] + p[1],
    sum[2] + (p[2] ?? 0.5),
    sum[3] + (p[3] ?? 0.5),
  ], [0, 0, 0, 0]).map(v => v / plane.quad.length);
}

export function planePointAt(plane, u, v) {
  const center = uvCenter(plane);

  for (let i = 0; i < plane.quad.length; i++) {
    const a = [center[2], center[3]];
    const b = [plane.quad[i][2] ?? 0.5, plane.quad[i][3] ?? 0.5];
    const c = [plane.quad[(i + 1) % plane.quad.length][2] ?? 0.5, plane.quad[(i + 1) % plane.quad.length][3] ?? 0.5];
    const bc = barycentric([u, v], a, b, c);
    if (!bc || bc.some(n => n < -0.001 || n > 1.001)) continue;

    const p0 = center;
    const p1 = plane.quad[i];
    const p2 = plane.quad[(i + 1) % plane.quad.length];
    return [
      p0[0] * bc[0] + p1[0] * bc[1] + p2[0] * bc[2],
      p0[1] * bc[0] + p1[1] * bc[1] + p2[1] * bc[2],
    ];
  }

  return [center[0], center[1]];
}

export function planeUvAt(plane, x, y) {
  const center = uvCenter(plane);

  for (let i = 0; i < plane.quad.length; i++) {
    const p0 = center;
    const p1 = plane.quad[i];
    const p2 = plane.quad[(i + 1) % plane.quad.length];
    const bc = barycentric([x, y], p0, p1, p2);
    if (!bc || bc.some(n => n < -0.001 || n > 1.001)) continue;

    return [
      clamp((p0[2] ?? 0.5) * bc[0] + (p1[2] ?? 0.5) * bc[1] + (p2[2] ?? 0.5) * bc[2], -2, 3),
      clamp((p0[3] ?? 0.5) * bc[0] + (p1[3] ?? 0.5) * bc[1] + (p2[3] ?? 0.5) * bc[2], -2, 3),
    ];
  }

  return null;
}

export function artworkQuadForPlane(plane, instance, scale = 1) {
  const t = instance.transform;
  const hw = t.width / 2;
  const hh = t.height / 2;
  const corners = [
    [-hw, -hh, 0, 0],
    [hw, -hh, 1, 0],
    [hw, hh, 1, 1],
    [-hw, hh, 0, 1],
  ];
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return corners.map(([x, y, su, sv]) => {
    const u = t.u + x * cos - y * sin;
    const v = t.v + x * sin + y * cos;
    const p = planePointAt(plane, u, v);
    return [p[0] * scale, p[1] * scale, su, sv];
  });
}

export function drawPlaneOverlays(ctx, planes, layers, options = {}) {
  const {
    selectedPlaneId = null,
    opacity = 0.3,
    showPoints = false,
    scale = 1,
    uiScale = 1,
  } = options;

  ctx.save();
  planes.forEach(plane => {
    if (layers.hidden?.[planeLayerId(plane.id)]) return;
    const selected = plane.id === selectedPlaneId;
    const alpha = selected ? Math.min(0.7, opacity + 0.24) : opacity;

    ctx.beginPath();
    ctx.moveTo(plane.quad[0][0] * scale, plane.quad[0][1] * scale);
    for (let i = 1; i < plane.quad.length; i++) {
      ctx.lineTo(plane.quad[i][0] * scale, plane.quad[i][1] * scale);
    }
    ctx.closePath();
    ctx.fillStyle = selected
      ? `rgba(108,143,255,${alpha * 0.35})`
      : `rgba(154,160,168,${alpha * 0.18})`;
    ctx.strokeStyle = selected
      ? `rgba(108,143,255,${alpha})`
      : `rgba(154,160,168,${alpha})`;
    ctx.lineWidth = (selected ? 2 : 1.25) * uiScale;
    ctx.fill();
    ctx.stroke();

    if (showPoints) {
      plane.quad.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * scale, y * scale, (selected ? 5 : 3.5) * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = selected ? '#ffffff' : `rgba(232,234,237,${alpha})`;
        ctx.fill();
        ctx.strokeStyle = selected ? '#6c8fff' : `rgba(154,160,168,${alpha})`;
        ctx.lineWidth = 1.5 * uiScale;
        ctx.stroke();
      });
    }
  });
  ctx.restore();
}

function drawFree(ctx, instance, scale) {
  const { x, y, width, height, rotation, opacity, blendMode } = instance.transform;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = blendMode === 'normal' ? 'source-over' : blendMode;
  ctx.translate(x * scale, y * scale);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(instance.asset.img, -width * scale / 2, -height * scale / 2, width * scale, height * scale);
  ctx.restore();
}

export function compositeArtworkInstance(canvas, instance, planesById, planeIds, scale = 1) {
  if (instance.targetId === 'free') {
    drawFree(canvas.getContext('2d'), instance, scale);
    return;
  }

  planeIds.forEach(id => {
    const plane = planesById.get(id);
    if (!plane) return;
    const quad = artworkQuadForPlane(plane, instance, scale);

    const pixels = warpAndComposite(
      canvas,
      instance.asset.img,
      quad,
      instance.transform.opacity,
      instance.transform.blendMode,
    );
    putPixels(canvas, pixels);
  });
}
