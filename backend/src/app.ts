import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware';
import { prisma } from './lib/prisma';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';

const app: Express = express();

// Middlewares
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  let dbLatencyMs: number | null = null;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
    dbStatus = 'connected';
  } catch (err: any) {
    dbStatus = `disconnected: ${err.message || 'database unreachable'}`;
  }

  const isDbConnected = dbStatus === 'connected';

  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'jadoon-sms-backend',
    database: {
      status: dbStatus,
      ...(dbLatencyMs !== null ? { latencyMs: dbLatencyMs } : {}),
    },
  });
});

// Mount module routes
app.use('/api/auth', authRoutes);

// Fallback 404 for unknown routes
app.use((req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// Global error handler
app.use(errorHandler);

export default app;
