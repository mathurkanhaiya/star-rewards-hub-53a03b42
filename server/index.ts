import express from 'express';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Production: serve Vite build as SPA ──────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
});
