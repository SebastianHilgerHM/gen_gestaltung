import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { readFile } from 'node:fs/promises';

const COMFY_URL = process.env.COMFY_URL || 'https://cloud.comfy.org';
const COMFY_API_KEY = process.env.COMFY_API_KEY || '';
const PORT = process.env.PORT || 8189;

const auth = COMFY_API_KEY ? { 'X-API-Key': COMFY_API_KEY } : {};

const workflow = JSON.parse(
  await readFile(new URL('./workflows/gallery-collage-inpaint.json', import.meta.url)),
);

const app = express();

app.get('/health', (req, res) => {
  res.json({
    proxy: 'ok',
    target: COMFY_URL,
    apiKey: COMFY_API_KEY ? 'set' : 'missing',
  });
});

async function uploadImage(dataUrl) {
  const [, mime, b64] = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  const blob = new Blob([Buffer.from(b64, 'base64')], { type: mime });
  const form = new FormData();
  form.append('image', blob, 'input.png');

  const res = await fetch(`${COMFY_URL}/api/upload/image`, {
    method: 'POST',
    headers: auth,
    body: form,
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const data = await res.json();
  console.log('[upload]', JSON.stringify(data));
  return data;
}

async function submitPrompt(name, subfolder) {
  const prompt = structuredClone(workflow);
  prompt['1'].inputs.image = subfolder ? `${subfolder}/${name}` : name;
  prompt['9'].inputs.seed = Math.floor(Math.random() * 1e15);

  const res = await fetch(`${COMFY_URL}/api/prompt`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`prompt failed (${res.status})`);
  const data = await res.json();
  console.log('[prompt]', JSON.stringify(data));
  return data.prompt_id;
}

function extractImages(outputs) {
  const debug = new Set(['16', '17', '18', '19']);
  return outputs['14']?.images?.length
    ? outputs['14'].images
    : Object.entries(outputs)
        .filter(([id]) => !debug.has(id))
        .flatMap(([, out]) => out.images || []);
}

async function waitForImages(promptId) {
  const failed = new Set(['failed', 'error', 'cancelled', 'canceled']);
  let last = null;
  for (let i = 0; i < 150; i++) {
    const res = await fetch(`${COMFY_URL}/api/jobs/${promptId}`, { headers: auth });
    const job = await res.json();
    if (job.status !== last) {
      console.log('[job]', job.status);
      last = job.status;
    }
    if (failed.has(job.status)) {
      throw new Error(`job ${job.status}${job.error_message ? ': ' + job.error_message : ''}`);
    }
    const images = extractImages(job.outputs || {});
    if (images.length) return images;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('job timed out');
}

app.post('/api/generate', express.json({ limit: '25mb' }), async (req, res) => {
  if (!COMFY_API_KEY) return res.status(400).json({ error: 'COMFY_API_KEY not set' });
  if (!req.body.image) return res.status(400).json({ error: 'no image provided' });

  try {
    const { name, subfolder } = await uploadImage(req.body.image);
    const promptId = await submitPrompt(name, subfolder);
    const images = (await waitForImages(promptId)).map((img) => {
      const q = new URLSearchParams({
        filename: img.filename,
        subfolder: img.subfolder || '',
        type: img.type || 'output',
      });
      return `/comfy/api/view?${q}`;
    });
    console.log('[result]', JSON.stringify(images));
    res.json({ images, promptId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(
  '/comfy',
  createProxyMiddleware({
    target: COMFY_URL,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/comfy': '' },
    on: {
      proxyReq: (proxyReq) => {
        if (COMFY_API_KEY) proxyReq.setHeader('X-API-Key', COMFY_API_KEY);
      },
    },
  }),
);

app.listen(PORT, () => console.log(`proxy on :${PORT} -> ${COMFY_URL}`));
