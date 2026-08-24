import { Request, Response, NextFunction } from 'express';

// Scaffolded for Phase 0 - will be fully implemented with JWT verification in Phase 1
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  next();
}
