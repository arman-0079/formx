import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { initDatabase } from './server/db.ts';
import { authRouter } from './server/auth.ts';
import { apiRouter } from './server/routes.ts';
import { ensureDemoSeed } from './server/seed.ts';
import { db } from './server/db.ts';

dotenv.config();

initDatabase();
ensureDemoSeed(db);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'formx' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', apiRouter);

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FormX server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FormX server:', err);
  process.exit(1);
});
