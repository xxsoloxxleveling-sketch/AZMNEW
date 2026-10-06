import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User account not found or session invalid',
        },
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'This account is inactive. Contact the system administrator.',
        },
      });
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Session expired or invalidated. Please log in again.',
        },
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      status: user.status,
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
