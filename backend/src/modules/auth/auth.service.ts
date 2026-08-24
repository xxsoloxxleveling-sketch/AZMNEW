import { prisma } from '../../lib/prisma';
import { comparePassword } from '../../lib/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { LoginInput } from './auth.schema';
import { AppError } from '../../middleware/error.middleware';

export class AuthService {
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ userId: user.id });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        const error: AppError = new Error('User associated with token not found');
        error.statusCode = 401;
        throw error;
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      };

      const newAccessToken = signAccessToken(payload);
      const newRefreshToken = signRefreshToken({ userId: user.id });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (err: any) {
      const error: AppError = new Error(err.message || 'Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }
  }

  logout() {
    return {
      message: 'Logged out successfully',
    };
  }
}

export const authService = new AuthService();
