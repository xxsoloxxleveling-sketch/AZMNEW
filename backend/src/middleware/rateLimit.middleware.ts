import { Request, Response, NextFunction } from 'express';

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

