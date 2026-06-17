const THETA_COUNT = 180;
const MAX_POINTS = 6500;
const MAX_LINES = 24;

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
  const rw = Math.min(260, w * 0.62);
  const rh = Math.min(220, h * 0.62);
  return normalizeRect(
    [p[0] - rw / 2, p[1] - rh / 2],
    [p[0] + rw / 2, p[1] + rh / 2],
    w,
    h,
  );
}

function polygonArea(points) {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
}

function orderQuad(points) {
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const sorted = [...points].sort((a, b) =>
    Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx)
  );

  if (polygonArea(sorted) < 0) sorted.reverse();

  const start = sorted.reduce((best, p, i) => (
    p[0] + p[1] < sorted[best][0] + sorted[best][1] ? i : best
  ), 0);
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

function angleGap(a, b) {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
}

function lineDistance(line, x, y) {
  return x * line.cos + y * line.sin - line.rho;
}

function intersect(a, b) {
  const det = a.cos * b.sin - b.cos * a.sin;
  if (Math.abs(det) < 0.08) return null;

  return [
    (a.rho * b.sin - b.rho * a.sin) / det,
    (a.cos * b.rho - b.cos * a.rho) / det,
  ];
}

function grayAndBlur(data, w, h) {
  const gray = new Float32Array(w * h);
  const blur = new Float32Array(w * h);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      blur[i] = (
        gray[i] * 4
        + (gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w]) * 2
        + gray[i - w - 1] + gray[i - w + 1] + gray[i + w - 1] + gray[i + w + 1]
      ) / 16;
    }
  }

  return blur;
}

function edgePoints(data, w, h) {
  const gray = grayAndBlur(data, w, h);
  const grads = [];
  let sum = 0;
  let sumSq = 0;

  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] + gray[i - w + 1]
        -2 * gray[i - 1] + 2 * gray[i + 1]
        -gray[i + w - 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
        + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const mag = Math.hypot(gx, gy);
      grads.push({ x, y, mag });
      sum += mag;
      sumSq += mag * mag;
    }
  }

  const mean = sum / grads.length;
  const sd = Math.sqrt(Math.max(0, sumSq / grads.length - mean * mean));
  const sorted = [...grads].sort((a, b) => b.mag - a.mag);
  const percentile = sorted[Math.floor(sorted.length * 0.12)]?.mag ?? 0;
  const threshold = Math.max(18, mean + sd * 0.9, percentile);
  return sorted.filter(p => p.mag >= threshold).slice(0, MAX_POINTS);
}

function houghLines(points, w, h) {
  const diag = Math.ceil(Math.hypot(w, h));
  const rhoStep = Math.max(2, Math.round(Math.max(w, h) / 260));
  const rhoBins = Math.ceil((diag * 2) / rhoStep) + 1;
  const acc = new Float32Array(THETA_COUNT * rhoBins);
  const trig = Array.from({ length: THETA_COUNT }, (_, i) => {
    const theta = i * Math.PI / THETA_COUNT;
    return { theta, cos: Math.cos(theta), sin: Math.sin(theta) };
  });

  points.forEach(p => {
    trig.forEach((t, i) => {
      const rho = p.x * t.cos + p.y * t.sin;
      const r = Math.round((rho + diag) / rhoStep);
      acc[i * rhoBins + r] += p.mag;
    });
  });

  const bins = [];
  for (let i = 0; i < acc.length; i++) {
    if (acc[i] > 0) bins.push(i);
  }
  bins.sort((a, b) => acc[b] - acc[a]);

  const lines = [];
  for (const index of bins) {
    const thetaIndex = Math.floor(index / rhoBins);
    const r = index % rhoBins;
    const t = trig[thetaIndex];
    const rho = r * rhoStep - diag;
    const duplicate = lines.some(line =>
      angleGap(line.theta, t.theta) < Math.PI / 28 && Math.abs(line.rho - rho) < 16
    );

    if (duplicate) continue;

    const line = supportLine({ ...t, rho, score: acc[index] }, points);
    if (line.length > Math.min(w, h) * 0.16) lines.push(line);
    if (lines.length >= MAX_LINES) break;
  }

  return lines.sort((a, b) => b.score - a.score);
}

function supportLine(line, points) {
  const dx = -line.sin;
  const dy = line.cos;
  let score = 0;
  let min = Infinity;
  let max = -Infinity;

  points.forEach(p => {
    const d = Math.abs(lineDistance(line, p.x, p.y));
    if (d > 2.8) return;

    const t = p.x * dx + p.y * dy;
    score += p.mag * (1 - d / 2.8);
    min = Math.min(min, t);
    max = Math.max(max, t);
  });

  return {
    ...line,
    dir: (line.theta + Math.PI / 2) % Math.PI,
    score,
    length: max - min,
  };
}

function linePairs(lines, w, h) {
  const center = [w / 2, h / 2];
  const minDistance = Math.min(w, h) * 0.12;
  const pairs = [];

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (angleGap(a.dir, b.dir) > Math.PI / 7) continue;

      const da = lineDistance(a, center[0], center[1]);
      const db = lineDistance(b, center[0], center[1]);
      const distance = Math.abs(da - db);
      if (distance < minDistance) continue;

      pairs.push({
        lines: [a, b],
        dir: (a.dir + b.dir) / 2,
        score: a.score + b.score + distance * 16 + (da * db <= 0 ? 9000 : 0),
      });
    }
  }

  return pairs.sort((a, b) => b.score - a.score).slice(0, 40);
}

function quadFromPairs(a, b, w, h) {
  const pts = [
    intersect(a.lines[0], b.lines[0]),
    intersect(a.lines[0], b.lines[1]),
    intersect(a.lines[1], b.lines[1]),
    intersect(a.lines[1], b.lines[0]),
  ];
  if (pts.some(p => !p)) return null;

  const quad = orderQuad(pts);
  const area = Math.abs(polygonArea(quad));
  const margin = Math.max(14, Math.min(w, h) * 0.16);
  const outside = quad.reduce((sum, [x, y]) => (
    sum
    + Math.max(0, -x - margin, x - w - margin)
    + Math.max(0, -y - margin, y - h - margin)
  ), 0);
  const ratio = area / (w * h);

  if (outside > margin * 2 || ratio < 0.045 || ratio > 1.7) return null;

  return {
    quad,
    score: a.score + b.score + Math.min(ratio, 1) * 18000 - outside * 250,
  };
}

function findQuad(points, w, h) {
  const lines = houghLines(points, w, h);
  const pairs = linePairs(lines, w, h);
  let best = null;

  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const gap = angleGap(pairs[i].dir, pairs[j].dir);
      if (gap < Math.PI / 4 || gap > Math.PI * 3 / 4) continue;

      const result = quadFromPairs(pairs[i], pairs[j], w, h);
      if (result && (!best || result.score > best.score)) best = result;
    }
  }

  return best?.quad ?? null;
}

export function detectQuadFromImage(img, canvasSize, start, end) {
  const { width, height } = canvasSize;
  const rawRect = normalizeRect(start, end, width, height);
  const rect = rawRect.w < 8 || rawRect.h < 8
    ? expandedClickRect(start, width, height)
    : rawRect;

  if (rect.w < 18 || rect.h < 18) return fallbackQuad(rect);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.max(18, Math.round(rect.w));
  const h = Math.max(18, Math.round(rect.h));
  const { data } = ctx.getImageData(x, y, w, h);
  const points = edgePoints(data, w, h);
  const quad = points.length >= 28 ? findQuad(points, w, h) : null;

  if (!quad) return fallbackQuad(rect);

  return quad.map(([px, py]) => [
    clamp(px + x, 0, width - 1),
    clamp(py + y, 0, height - 1),
  ]);
}
