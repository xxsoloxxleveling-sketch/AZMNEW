import { Request, Response, NextFunction } from 'express';

// Scaffolded for Phase 0 - will be fully implemented in Phase 1
export function authorizeRoles(..._allowedRoles: string[]) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}
