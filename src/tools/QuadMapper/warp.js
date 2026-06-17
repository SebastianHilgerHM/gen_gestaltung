import { computeHomography, applyHomography } from './homography.js';

export function warpAndComposite(bgCanvas, artworkImg, quad, opacity, blendMode, sourceRect = null) {
  const w = bgCanvas.width;
  const h = bgCanvas.height;
  const ctx = bgCanvas.getContext('2d');
  const bg = ctx.getImageData(0, 0, w, h);
  const aw = artworkImg.naturalWidth;
  const ah = artworkImg.naturalHeight;
  const sx = sourceRect?.x ?? 0;
  const sy = sourceRect?.y ?? 0;
  const sw = sourceRect?.width ?? aw;
  const sh = sourceRect?.height ?? ah;
  const artCanvas = document.createElement('canvas');
  artCanvas.width = aw;
  artCanvas.height = ah;
  const artCtx = artCanvas.getContext('2d');
  artCtx.drawImage(artworkImg, 0, 0);
  const art = artCtx.getImageData(0, 0, aw, ah).data;
  const out = new ImageData(new Uint8ClampedArray(bg.data), w, h);

  if (quad.length === 4) {
    const src = quad.map((point, i) => sourcePoint(point, i, sx, sy, sw, sh));
    const H = computeHomography(quad, src);
    if (!H) return bg;

    rasterizePolygon(out, art, aw, ah, quad, (x, y) => applyHomography(H, x, y), opacity, blendMode);
    return out;
  }

  const center = quad.reduce((sum, point) => [
    sum[0] + point[0],
    sum[1] + point[1],
    sum[2] + (point[2] ?? 0.5),
    sum[3] + (point[3] ?? 0.5),
  ], [0, 0, 0, 0]).map(v => v / quad.length);

  for (let i = 0; i < quad.length; i++) {
    const dst = [center, quad[i], quad[(i + 1) % quad.length]];
    const src = dst.map((point, j) => (
      j === 0
        ? [sx + point[2] * sw, sy + point[3] * sh]
        : sourcePoint(point, 0, sx, sy, sw, sh)
    ));
    const map = affineMap(dst, src);
    if (map) rasterizeTriangle(out, art, aw, ah, dst, map, opacity, blendMode);
  }

  return out;
}

function sourcePoint(point, i, sx, sy, sw, sh) {
  const fallback = [[0, 0], [1, 0], [1, 1], [0, 1]][i] ?? [0.5, 0.5];
  const u = point[2] ?? fallback[0];
  const v = point[3] ?? fallback[1];
  return [sx + u * sw, sy + v * sh];
}

function rasterizePolygon(out, art, aw, ah, quad, map, opacity, blendMode) {
  const xs = quad.map(p => p[0]);
  const ys = quad.map(p => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(out.width - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(out.height - 1, Math.ceil(Math.max(...ys)));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!pointInPolygon(x, y, quad)) continue;

      const [sx, sy] = map(x, y);
      if (sx < 0 || sy < 0 || sx >= aw || sy >= ah) continue;

      blendInto(out, art, aw, ah, x, y, sx, sy, opacity, blendMode);
    }
  }
}

function rasterizeTriangle(out, art, aw, ah, tri, map, opacity, blendMode) {
  const xs = tri.map(p => p[0]);
  const ys = tri.map(p => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(out.width - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(out.height - 1, Math.ceil(Math.max(...ys)));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!pointInTriangle(x, y, tri)) continue;

      const [sx, sy] = map(x, y);
      if (sx < 0 || sy < 0 || sx >= aw || sy >= ah) continue;
      blendInto(out, art, aw, ah, x, y, sx, sy, opacity, blendMode);
    }
  }
}

function blendInto(out, art, aw, ah, x, y, sx, sy, opacity, blendMode) {
  const [ar, ag, ab, aa] = sampleBilinear(art, aw, ah, sx, sy);
  if (aa === 0) return;

  const data = out.data;
  const i = (y * out.width + x) * 4;
  const a = (aa / 255) * opacity;
  const br = data[i];
  const bg = data[i + 1];
  const bb = data[i + 2];
  const [r, g, b] = blendPixel(blendMode, br, bg, bb, ar, ag, ab);

  data[i] = Math.round(br * (1 - a) + r * a);
  data[i + 1] = Math.round(bg * (1 - a) + g * a);
  data[i + 2] = Math.round(bb * (1 - a) + b * a);
  data[i + 3] = 255;
}

function affineMap(dst, src) {
  const [a, b, c] = dst;
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(det) < 0.001) return null;

  return (x, y) => {
    const u = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / det;
    const v = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / det;
    return [
      src[0][0] + (src[1][0] - src[0][0]) * u + (src[2][0] - src[0][0]) * v,
      src[0][1] + (src[1][1] - src[0][1]) * u + (src[2][1] - src[0][1]) * v,
    ];
  };
}

function sampleBilinear(data, w, h, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  const lerp = (a, b, t) => a + (b - a) * t;
  const blerp = (c00, c10, c01, c11) =>
    lerp(lerp(c00, c10, fx), lerp(c01, c11, fx), fy);

  return [
    blerp(data[i00], data[i10], data[i01], data[i11]),
    blerp(data[i00 + 1], data[i10 + 1], data[i01 + 1], data[i11 + 1]),
    blerp(data[i00 + 2], data[i10 + 2], data[i01 + 2], data[i11 + 2]),
    blerp(data[i00 + 3], data[i10 + 3], data[i01 + 3], data[i11 + 3]),
  ];
}

function blendPixel(mode, br, bg, bb, sr, sg, sb) {
  switch (mode) {
    case 'multiply':
      return [br * sr / 255, bg * sg / 255, bb * sb / 255];
    case 'screen':
      return [
        255 - (255 - br) * (255 - sr) / 255,
        255 - (255 - bg) * (255 - sg) / 255,
        255 - (255 - bb) * (255 - sb) / 255,
      ];
    case 'overlay':
      return [overlayChannel(br, sr), overlayChannel(bg, sg), overlayChannel(bb, sb)];
    default:
      return [sr, sg, sb];
  }
}

function overlayChannel(b, s) {
  return b < 128
    ? 2 * b * s / 255
    : 255 - 2 * (255 - b) * (255 - s) / 255;
}

function pointInPolygon(px, py, points) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const hit = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }

  return inside;
}

function pointInTriangle(px, py, tri) {
  const [a, b, c] = tri;
  const d1 = side(px, py, a, b);
  const d2 = side(px, py, b, c);
  const d3 = side(px, py, c, a);
  return !(d1 < 0 || d2 < 0 || d3 < 0) || !(d1 > 0 || d2 > 0 || d3 > 0);
}

function side(px, py, a, b) {
  return (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
}
