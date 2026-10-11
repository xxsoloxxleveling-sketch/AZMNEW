import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { assertRestrictedRuntimeDatabase } from './security/dbRuntimeSafety';

async function bootstrap() {
  // Production must fail closed before opening an HTTP socket if the backend
  // still uses privileged schema-owner/migrator credentials.
  if (env.NODE_ENV === 'production') {
    await assertRestrictedRuntimeDatabase(prisma, {
      databaseUrl: env.DATABASE_URL,
      directUrl: env.DIRECT_URL || '',
    });
    logger.info('Production PostgreSQL runtime privilege boundary verified.');
  }
  // Synchronize new credentials and purge legacy accounts
  const host = process.env.HOST || (env.NODE_ENV === 'production' ? '127.0.0.1' : undefined);

  const server = host
    ? app.listen(env.PORT, host, () => {
        logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
        logger.info(`🩺 Health check available at http://${host}:${env.PORT}/api/health`);
        logger.info(`🔐 Auth endpoints available at http://${host}:${env.PORT}/api/auth`);
      })
    : app.listen(env.PORT, () => {
        logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
        logger.info(`🩺 Health check available at http://localhost:${env.PORT}/api/health`);
        logger.info(`🔐 Auth endpoints available at http://localhost:${env.PORT}/api/auth`);
      });

  const handleShutdown = async () => {
    logger.info('Shutting down server gracefully...');
    server.close(async () => {
      logger.info('HTTP server closed.');
      await prisma.$disconnect();
      logger.info('Database disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

bootstrap().catch(async () => {
  // Do not log connection details, environment values or database row data.
  logger.error('Backend initialization failed; refusing to serve HTTP.');
  try { await prisma.$disconnect(); } catch { /* preserve original failure */ }
  process.exit(1);
});
