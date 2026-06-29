import { drawTicket, TICKET_FIELDS } from './ticket.js';

export { TICKET_FIELDS };

export function renderComposite(canvas, { format, img, fields }) {
  const W = format?.width || img?.naturalWidth || 1024;
  const H = format?.height || img?.naturalHeight || 1024;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (format?.id === 'ticket') {
    drawTicket(ctx, { img, W, H, fields });
    return;
  }

  if (img) {
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = '#a9adb2';
    ctx.fillRect(0, 0, W, H);
  }
}
