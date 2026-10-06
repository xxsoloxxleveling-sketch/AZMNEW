import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import announcementsRoutes from './modules/announcements/announcements.routes';

import { logger } from './lib/logger';

const app: Express = express();

/**
 * Production Topology & Trust Proxy Configuration:
 * Topology: Client -> Cloudflare (Proxy/WAF) -> Nginx (Reverse Proxy on host) -> Express (Node backend :5000)
 *
 * Trust Proxy Hop Setting:
 * - Set to 1: Express trusts the immediate reverse proxy (local Nginx on 127.0.0.1).
 * - Nginx proxy header contract:
 *   Nginx MUST set `proxy_set_header X-Forwarded-For $http_cf_connecting_ip;` or ensure
 *   `$proxy_add_x_forwarded_for` forwards the authenticated Cloudflare client IP.
 * - This ensures req.ip resolves to the true client IP (via CF-Connecting-IP) and cannot be spoofed
 *   by untrusted client-supplied X-Forwarded-For headers, preserving accurate rate limiting.
 */
app.set('trust proxy', 1);

// Authoritative production origins
const productionStaticOrigins = [
  'https://azmaio.com',
  'https://www.azmaio.com',
];

// Development localhost origins
const developmentLocalOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5000',
];

const parseConfiguredOrigins = (): string[] => {
  return [env.CORS_ORIGIN, env.FRONTEND_URL]
    .filter(Boolean)
    .flatMap((o) => (o as string).split(',').map((s) => s.trim().replace(/\/+$/, '')))
    .filter(Boolean);
};

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow server-to-server, mobile app, CLI, or same-origin requests without an Origin header
  if (!origin) return true;

  // In non-production environments (development / test), allow local development origins
  if (env.NODE_ENV !== 'production') {
    if (developmentLocalOrigins.includes(origin)) return true;
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    } catch {}
  }

  // Exact match against configured environment origins (CORS_ORIGIN, FRONTEND_URL)
  const configuredOrigins = parseConfiguredOrigins();
  const normalizedOrigin = origin.replace(/\/+$/, '');
  if (configuredOrigins.includes(normalizedOrigin)) return true;

  // Exact match against authoritative production origins
  if (productionStaticOrigins.includes(normalizedOrigin)) return true;

  return false;
};

app.use(
  helmet({
    contentSecurityPolicy: false, // CSP enforced at Nginx layer for frontend SPA
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

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
      'X-Candidate-CNIC',
      'X-Partner-Mobile',
      'X-Partner-Email',
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
app.use('/api/announcements', announcementsRoutes);

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
