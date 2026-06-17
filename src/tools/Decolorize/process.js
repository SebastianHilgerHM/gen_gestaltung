import { luminance, rgbToHsl, lerp } from '../../utils/colorMath.js';
import { clamp } from '../../utils/imageData.js';

export function decolorize(srcPixels, { darkest, brightest, gamma, colorThreshold }) {
  const { data, width, height } = srcPixels;
  const out = new ImageData(width, height);
  const outData = out.data;
  const range = brightest - darkest;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const lum = luminance(r, g, b) / 255;
    const shade = clamp(darkest + Math.pow(lum, 1 / gamma) * range);
    const [, sat] = rgbToHsl(r, g, b);

    if (sat > colorThreshold) {
      const t = Math.min((sat - colorThreshold) / (1 - colorThreshold), 1);
      outData[i] = clamp(lerp(shade, r, t));
      outData[i + 1] = clamp(lerp(shade, g, t));
      outData[i + 2] = clamp(lerp(shade, b, t));
    } else {
      outData[i] = shade;
      outData[i + 1] = shade;
      outData[i + 2] = shade;
    }

    outData[i + 3] = a;
  }

  return out;
}
