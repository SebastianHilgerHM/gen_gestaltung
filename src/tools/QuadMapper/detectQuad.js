function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeRect(a, b, w, h) {
  const x0 = clamp(Math.min(a[0], b[0]), 0, w - 1);
  const y0 = clamp(Math.min(a[1], b[1]), 0, h - 1);
  const x1 = clamp(Math.max(a[0], b[0]), 0, w - 1);
  const y1 = clamp(Math.max(a[1], b[1]), 0, h - 1);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function fallbackQuad(rect) {
  const { x, y, w, h } = rect;
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

function expandedClickRect(p, w, h) {
  const rw = Math.min(180, w * 0.45);
  const rh = Math.min(140, h * 0.45);
  return normalizeRect(
    [p[0] - rw / 2, p[1] - rh / 2],
    [p[0] + rw / 2, p[1] + rh / 2],
    w,
    h,
  );
}

function corner(points, pick) {
  return points.reduce((best, p) => pick(p) < pick(best) ? p : best);
}

function maxCorner(points, pick) {
  return points.reduce((best, p) => pick(p) > pick(best) ? p : best);
}

export function detectQuadFromImage(img, canvasSize, start, end) {
  const { width, height } = canvasSize;
  const rawRect = normalizeRect(start, end, width, height);
  const rect = rawRect.w < 8 || rawRect.h < 8
    ? expandedClickRect(start, width, height)
    : rawRect;

  if (rect.w < 8 || rect.h < 8) return fallbackQuad(rect);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const x0 = Math.round(rect.x);
  const y0 = Math.round(rect.y);
  const rw = Math.max(8, Math.round(rect.w));
  const rh = Math.max(8, Math.round(rect.h));
  const { data } = ctx.getImageData(x0, y0, rw, rh);
  const gray = new Float32Array(rw * rh);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }

  const mags = [];
  let sum = 0;
  let sumSq = 0;

  for (let y = 1; y < rh - 1; y++) {
    for (let x = 1; x < rw - 1; x++) {
      const i = y * rw + x;
      const gx =
        -gray[i - rw - 1] + gray[i - rw + 1]
        -2 * gray[i - 1] + 2 * gray[i + 1]
        -gray[i + rw - 1] + gray[i + rw + 1];
      const gy =
        -gray[i - rw - 1] - 2 * gray[i - rw] - gray[i - rw + 1]
        + gray[i + rw - 1] + 2 * gray[i + rw] + gray[i + rw + 1];
      const mag = Math.hypot(gx, gy);
      mags.push([x0 + x, y0 + y, mag]);
      sum += mag;
      sumSq += mag * mag;
    }
  }

  const mean = sum / mags.length;
  const variance = sumSq / mags.length - mean * mean;
  const threshold = mean + Math.sqrt(Math.max(0, variance)) * 1.2;
  const points = mags
    .filter(([, , mag]) => mag > threshold)
    .sort((a, b) => b[2] - a[2])
    .slice(0, 900)
    .map(([x, y]) => [x, y]);

  if (points.length < 12) return fallbackQuad(rect);

  const tl = corner(points, ([x, y]) => x + y);
  const tr = maxCorner(points, ([x, y]) => x - y);
  const br = maxCorner(points, ([x, y]) => x + y);
  const bl = corner(points, ([x, y]) => x - y);
  const quad = [tl, tr, br, bl];
  const area = Math.abs(quad.reduce((sum, p, i) => {
    const q = quad[(i + 1) % quad.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2);

  return area > 64 ? quad : fallbackQuad(rect);
}
