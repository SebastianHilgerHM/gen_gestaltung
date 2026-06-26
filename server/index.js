import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const COMFY_URL = process.env.COMFY_URL || 'http://localhost:8188';
const PORT = process.env.PORT || 8189;

const app = express();

app.get('/health', async (req, res) => {
  const r = await fetch(`${COMFY_URL}/system_stats`).catch(() => null);
  res.json({ proxy: 'ok', comfyui: r?.ok ? 'ok' : 'down' });
});

app.use(
  '/comfy',
  createProxyMiddleware({
    target: COMFY_URL,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/comfy': '' },
  }),
);

app.listen(PORT, () => console.log(`proxy on :${PORT} -> ${COMFY_URL}`));
