import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';

/**
 * Pass-through middleware: IP rate limiting / banning is completely disabled.
 */
const noopLimiter = (_req: Request, _res: Response, next: NextFunction) => next();

/**
 * Rate limiter for authentication / login (Disabled).
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many failed login attempts. Please wait 15 minutes and try again.' },
  },
});

/**
 * Rate limiter for student and partner registrations (Disabled).
 */
export const registrationRateLimiter = noopLimiter;

/**
 * Authenticated high-throughput exam attendance marking protection.
 */
export const attendanceScanRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: req => req.user!.id,
  skip: req => !req.user?.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many examination attendance requests. Please wait a moment and retry.' } },
});

const standardRateLimitResponse = {
  success: false,
  error: { message: 'Too many requests. Please wait and try again.' },
};

/** Narrow limits for the public, short-lived candidate upload flow. */
export const uploadSessionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardRateLimitResponse,
});

export const documentUploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardRateLimitResponse,
});

/** Dedicated rate limiter for public Roll Number Slip search (enumeration protection: 60 req / 15 min per IP) */
export const publicSlipSearchRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many search requests from this IP. Please wait a few minutes and try again.' },
  },
});

