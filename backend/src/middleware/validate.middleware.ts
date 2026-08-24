import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.flatten().fieldErrors;
        const messages = Object.entries(fieldErrors)
          .map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`)
          .join('; ');

        return res.status(400).json({
          success: false,
          error: {
            message: `Validation failed: ${messages || 'Invalid form data'}`,
            details: fieldErrors,
          },
        });
      }
      next(error);
    }

  };
};
