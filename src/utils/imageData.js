export function putPixels(canvas, imageData) {
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
}

export function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function extractPixelsFromImage(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { imageData, width: canvas.width, height: canvas.height };
}
