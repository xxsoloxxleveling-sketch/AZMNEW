import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const createJsonRateLimiter = (options: Partial<Options>) => {
  return rateLimit({
    standardHeaders: true, // Return standard RateLimit headers (draft-6 / draft-7)
    legacyHeaders: false, // Disable X-RateLimit-* headers
    statusCode: 429,
    handler: (_req: Request, res: Response, _next: NextFunction, opts: Options) => {
      res.status(opts.statusCode).json({
        success: false,
        error: {
          message: typeof opts.message === 'string' ? opts.message : 'Too many requests, please try again later.',
        },
      });
    },
    ...options,
  });
};

/**
 * Rate limiter for authentication / login to prevent brute force attacks.
 * Limit: 5 requests per 15 minutes per IP.
 */
export const loginRateLimiter = createJsonRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
});

/**
 * Rate limiter for student and partner registrations to prevent spam.
 * Limit: 10 requests per 1 hour per IP.
 */
export const registrationRateLimiter = createJsonRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  message: 'Too many registration requests from this IP, please try again after an hour.',
});

/**
 * Rate limiter for attendance scanning to prevent abuse.
 * Limit: 60 requests per 1 minute per IP.
 */
export const attendanceScanRateLimiter = createJsonRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 60,
  message: 'Too many attendance scan requests from this IP, please try again shortly.',
});
