import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const isClientError = statusCode >= 400 && statusCode < 500;

  // Mask message in production for 500-level internal errors to prevent leaking internal details
  const clientMessage = isProduction && !isClientError
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  // Server-side logging with full diagnostics in all environments
  logger.error(
    `[${req.method} ${req.originalUrl}] Error [${statusCode}]: ${err.message || 'Unknown error'}`,
    err.stack || err
  );

  res.status(statusCode).json({
    success: false,
    error: {
      message: clientMessage,
      ...(err.details && (!isProduction || isClientError) ? { details: err.details } : {}),
      ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
    },
  });
}
