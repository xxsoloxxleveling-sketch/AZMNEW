import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
  code?: string;
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  let statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : 500);
  let clientMessage = err.message || 'An unexpected error occurred';
  let details = err.details;

  // 1. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : (err.meta?.target as string) || 'unique field';
      if (target.includes('cnicOrBForm')) {
        clientMessage = 'A student with this CNIC / B-Form is already registered in the system.';
      } else if (target.includes('applicationNo')) {
        clientMessage = 'An application with this Application Number already exists.';
      } else if (target.includes('rollNumber')) {
        clientMessage = 'A student with this Roll Number is already registered.';
      } else {
        clientMessage = `A record with this ${target} already exists.`;
      }
    } else if (err.code === 'P2025') {
      statusCode = 404;
      clientMessage = 'The requested record was not found.';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      clientMessage = 'Database foreign key constraint failed. Related record does not exist.';
    } else {
      statusCode = 400;
      clientMessage = `Database operation error (${err.code}): ${err.message.split('\n').pop() || 'Query failed'}`;
    }
  } 
  // 2. Prisma Client Validation Errors (e.g. Invalid Date or wrong types)
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    const lines = err.message.split('\n');
    const cleanMsg = lines[lines.length - 1] || 'Invalid data format or missing required database fields.';
    clientMessage = `Database validation failed: ${cleanMsg}`;
  }
  // 3. Zod Schema Validation Errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    const fieldErrors = err.flatten().fieldErrors;
    const messages = Object.entries(fieldErrors)
      .map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`)
      .join('; ');
    clientMessage = `Validation failed: ${messages || 'Invalid form input'}`;
    details = fieldErrors;
  }
  // 4. Payload / Body Parser Errors
  else if (err.type === 'entity.too.large' || err.status === 413) {
    statusCode = 413;
    clientMessage = 'Uploaded data or images exceed the server payload limit. Please compress photos before uploading.';
  }
  // 5. JSON Syntax Errors
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    clientMessage = 'Invalid JSON format in request body.';
  }

  const isClientError = statusCode >= 400 && statusCode < 500;

  if (process.env.NODE_ENV === 'production' && !isClientError) {
    clientMessage = 'Internal Server Error';
    details = undefined;
  }

  // Server-side logging with full diagnostics in all environments
  logger.error(
    `[${req.method} ${req.originalUrl}] Error [${statusCode}]: ${err.message || clientMessage}`,
    err.stack || err
  );

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code,
      message: clientMessage,
      ...(details ? { details } : {}),
      ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
    },
  });
}
