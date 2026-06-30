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
  // two rounded cards (main image panel + right stub), per SVG layout
  const r = H * 0.064;
  const mainW = W * 0.748;
  const stubX = W * 0.751;
  const stubW = W - stubX;

  // main image card
  ctx.save();
  roundRect(ctx, 0, 0, mainW, H, r);
  ctx.clip();
  if (img) {
    const scale = Math.max(mainW / img.naturalWidth, H / img.naturalHeight);
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    ctx.drawImage(img, (mainW - iw) / 2, (H - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = '#a5a5a5';
    ctx.fillRect(0, 0, mainW, H);
  }
  ctx.restore();

  // right stub card
  ctx.fillStyle = '#fff';
  roundRect(ctx, stubX, 0, stubW, H, r);
  ctx.fill();

  // brand label (white box, vertical text) — box sized to fit the text
  const fs1 = H * 0.05;
  const fs2 = H * 0.044;
  const ls = fs1 * 0.12;
  const font1 = `800 ${fs1}px Inter, system-ui, sans-serif`;
  const font2 = `300 ${fs2}px Inter, system-ui, sans-serif`;

  ctx.save();
  ctx.letterSpacing = `${ls}px`;
  ctx.font = font1;
  const wTop = ctx.measureText(fields.brandTop).width;
  ctx.font = font2;
  const wBottom = ctx.measureText(fields.brandBottom).width;
  ctx.restore();

  const cap1 = fs1 * 0.74;
  const cap2 = fs2 * 0.74;
  const innerGap = fs1 * 0.24;
  const padH = fs1 * 0.45;
  const padV = fs1 * 0.45;

  const boxW = cap1 + cap2 + innerGap + padH * 2;
  const boxH = Math.max(wTop, wBottom) + padV * 2;
  const bx = W * 0.03;
  const by = (H - boxH) / 2;

  ctx.fillStyle = '#fff';
  roundRect(ctx, bx, by, boxW, boxH, boxW * 0.16);
  ctx.fill();

  ctx.save();
  ctx.translate(bx + boxW / 2, by + boxH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${ls}px`;
  ctx.fillStyle = '#111';
  ctx.font = font1;
  ctx.fillText(fields.brandTop, 0, innerGap / 2 + cap1 / 2);
  ctx.font = font2;
  ctx.fillText(fields.brandBottom, 0, -(innerGap / 2 + cap2 / 2));
  ctx.restore();

  // price (top of right stub)
  const right = W - W * 0.022;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111';
  ctx.font = `600 ${H * 0.044}px Inter, system-ui, sans-serif`;
  ctx.fillText(fields.priceMain, right, H * 0.135);
  ctx.fillStyle = '#8a8f96';
  ctx.font = `400 ${H * 0.03}px Inter, system-ui, sans-serif`;
  ctx.fillText(fields.priceSub, right, H * 0.195);

  // barcode (bottom of right stub)
  drawBarcode(ctx, stubX + stubW * 0.1, H * 0.72, stubW * 0.8, H * 0.16, fields.priceMain + fields.priceSub);
}
