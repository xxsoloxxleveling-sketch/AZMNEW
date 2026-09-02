import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
async function bootstrap() {
  // STAGING SAFETY: preserve imported production users.


  const server = app.listen(env.PORT, '127.0.0.1', () => {
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

bootstrap();
