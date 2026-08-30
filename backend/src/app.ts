import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware';
import { prisma } from './lib/prisma';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import studentsRoutes from './modules/students/students.routes';
import partnersRoutes from './modules/partners/partners.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import feesRoutes from './modules/fees/fees.routes';
import staffRoutes from './modules/staff/staff.routes';
import payrollRoutes from './modules/payroll/payroll.routes';
import transactionsRoutes from './modules/transactions/transactions.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import usersRoutes from './modules/users/users.routes';
import testCentersRoutes from './modules/test-centers/testCenters.routes';
import examHallsRoutes from './modules/exam-halls/examHalls.routes';
import grievancesRoutes from './modules/grievances/grievances.routes';
import resultsRoutes from './modules/results/results.routes';

import { logger } from './lib/logger';

const app: Express = express();
app.set('trust proxy', 1);

// Middlewares
const allowedOrigins = [
  env.CORS_ORIGIN,
  env.FRONTEND_URL,
  'https://azmaio.com',
  'https://www.azmaio.com',
  'http://azmaio.com',
  'http://www.azmaio.com',
  'https://azmnew.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5000',
].filter(Boolean) as string[];

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (env.NODE_ENV !== 'production') return true;

  // Exact match
  if (allowedOrigins.includes(origin)) return true;

  // Comma-separated env entries
  const envOrigins = [env.CORS_ORIGIN, env.FRONTEND_URL]
    .filter(Boolean)
    .flatMap((o) => (o as string).split(',').map((s) => s.trim()));
  if (envOrigins.includes(origin)) return true;

  // Domain & subdomain matching
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (
      host === 'azmaio.com' ||
      host.endsWith('.azmaio.com') ||
      host === 'onrender.com' ||
      host.endsWith('.onrender.com') ||
      host.endsWith('.hostingersite.com') ||
      host.endsWith('.hostinger.com') ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.netlify.app')
    ) {
      return true;
    }
  } catch {}

  return false;
};

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS rejected for origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'X-Upload-Session',
      'X-Candidate-Key',
      'X-Document-Type',
      'X-File-Name',
    ],
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  })
);
app.options('*', cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));


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
    service: 'azmaio-backend',
    database: {
      status: dbStatus,
      ...(dbLatencyMs !== null ? { latencyMs: dbLatencyMs } : {}),
    },
  });
});

// Mount module routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/partners', partnersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/test-centers', testCentersRoutes);
app.use('/api/exam-halls', examHallsRoutes);
app.use('/api/grievances', grievancesRoutes);
app.use('/api/results', resultsRoutes);

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
