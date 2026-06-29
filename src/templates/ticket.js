export const TICKET_FIELDS = {
  brandTop: 'KUNSTHALLE',
  brandBottom: 'MÜNCHEN',
  priceMain: 'EINTRITT REGULÄR | 18€',
  priceSub: 'keine ermäßigung',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function leftRoundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + r, y);
  ctx.arcTo(x, y, x, y + r, r);
  ctx.lineTo(x, y + h - r);
  ctx.arcTo(x, y + h, x + r, y + h, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  ctx.fillStyle = '#111';
  let cx = x;
  while (cx < x + w) {
    const bw = 1 + Math.floor(rand() * 5);
    if (rand() > 0.4) ctx.fillRect(Math.round(cx), y, bw, h);
    cx += bw + 1 + Math.floor(rand() * 3);
  }
}

export function drawTicket(ctx, { img, W, H, fields }) {
  const r = H * 0.06;
  const gap = W * 0.012;
  const splitX = W * 0.73;

  // white card base (right stub is white)
  ctx.fillStyle = '#fff';
  roundRect(ctx, 0, 0, W, H, r);
  ctx.fill();

  // image panel (left, rounded left corners)
  ctx.save();
  leftRoundedPath(ctx, 0, 0, splitX, H, r);
  ctx.clip();
  if (img) {
    const scale = Math.max(splitX / img.naturalWidth, H / img.naturalHeight);
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    ctx.drawImage(img, (splitX - iw) / 2, (H - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = '#a9adb2';
    ctx.fillRect(0, 0, splitX, H);
  }
  ctx.restore();

  // perforation
  ctx.save();
  ctx.strokeStyle = 'rgba(120,124,130,0.55)';
  ctx.lineWidth = Math.max(2, H * 0.004);
  ctx.setLineDash([H * 0.022, H * 0.018]);
  ctx.beginPath();
  ctx.moveTo(splitX + gap / 2, H * 0.05);
  ctx.lineTo(splitX + gap / 2, H * 0.95);
  ctx.stroke();
  ctx.restore();

  // brand label (white box, vertical text)
  const bw = W * 0.09;
  const bh = H * 0.52;
  const bx = W * 0.03;
  const by = (H - bh) / 2;
  ctx.fillStyle = '#fff';
  roundRect(ctx, bx, by, bw, bh, bw * 0.16);
  ctx.fill();
  ctx.save();
  ctx.translate(bx + bw / 2, by + bh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111';
  ctx.letterSpacing = `${bw * 0.05}px`;
  ctx.font = `800 ${bw * 0.34}px Inter, system-ui, sans-serif`;
  ctx.fillText(fields.brandTop, 0, bw * 0.18);
  ctx.font = `300 ${bw * 0.3}px Inter, system-ui, sans-serif`;
  ctx.fillText(fields.brandBottom, 0, -bw * 0.24);
  ctx.restore();

  // price (top of right stub)
  const right = W - W * 0.025;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111';
  ctx.font = `600 ${H * 0.045}px Inter, system-ui, sans-serif`;
  ctx.fillText(fields.priceMain, right, H * 0.14);
  ctx.fillStyle = '#8a8f96';
  ctx.font = `400 ${H * 0.03}px Inter, system-ui, sans-serif`;
  ctx.fillText(fields.priceSub, right, H * 0.2);

  // barcode (bottom of right stub)
  const cw = (W - (splitX + gap)) - W * 0.05;
  const cx = splitX + gap + W * 0.02;
  drawBarcode(ctx, cx, H * 0.74, cw, H * 0.14, fields.priceMain + fields.priceSub);
}
