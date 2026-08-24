import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';

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

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Authentication token required (format: Bearer <token>)',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired token',
      },
    });
  }
}
