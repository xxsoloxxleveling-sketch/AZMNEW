import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';

/**
 * Pass-through middleware: IP rate limiting / banning is completely disabled.
 */
const noopLimiter = (_req: Request, _res: Response, next: NextFunction) => next();

/**
 * Rate limiter for authentication / login (Disabled).
 */
export const loginRateLimiter = noopLimiter;

/**
 * Rate limiter for student and partner registrations (Disabled).
 */
export const registrationRateLimiter = noopLimiter;

/**
 * Rate limiter for attendance scanning (Disabled).
 */
export const attendanceScanRateLimiter = noopLimiter;

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

