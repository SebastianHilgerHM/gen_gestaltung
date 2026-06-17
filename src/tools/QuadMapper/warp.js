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
  const src = [[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]];
  const H = computeHomography(quad, src);

  if (!H) return bg;

  const artCanvas = document.createElement('canvas');
  artCanvas.width = aw;
  artCanvas.height = ah;
  const artCtx = artCanvas.getContext('2d');
  artCtx.drawImage(artworkImg, 0, 0);
  const art = artCtx.getImageData(0, 0, aw, ah).data;
  const out = new ImageData(new Uint8ClampedArray(bg.data), w, h);
  const data = out.data;
  const xs = quad.map(p => p[0]);
  const ys = quad.map(p => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(...ys)));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!pointInQuad(x, y, quad)) continue;

      const [sx, sy] = applyHomography(H, x, y);
      if (sx < 0 || sy < 0 || sx >= aw || sy >= ah) continue;

      const [ar, ag, ab, aa] = sampleBilinear(art, aw, ah, sx, sy);
      if (aa === 0) continue;

      const i = (y * w + x) * 4;
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
  }

  return out;
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

function pointInQuad(px, py, quad) {
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % 4];
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (cross < 0) return false;
  }

  return true;
}
