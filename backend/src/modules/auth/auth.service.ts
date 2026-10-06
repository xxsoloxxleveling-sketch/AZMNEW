import { prisma } from '../../lib/prisma';
import { comparePassword, hashPassword } from '../../lib/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { LoginInput, ChangePasswordInput } from './auth.schema';
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

    if (user.status !== 'ACTIVE') {
      const error: AppError = new Error('This account is inactive. Contact the system administrator.');
      error.statusCode = 403;
      throw error;
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ userId: user.id, tokenVersion: user.tokenVersion });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
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

      if (user.status !== 'ACTIVE') {
        const error: AppError = new Error('This account is inactive. Contact the system administrator.');
        error.statusCode = 403;
        throw error;
      }

      if (decoded.tokenVersion !== user.tokenVersion) {
        const error: AppError = new Error('Session expired or invalidated. Please log in again.');
        error.statusCode = 401;
        throw error;
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tokenVersion: user.tokenVersion,
      };

      const newAccessToken = signAccessToken(payload);
      const newRefreshToken = signRefreshToken({ userId: user.id, tokenVersion: user.tokenVersion });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (err: any) {
      if (err.statusCode) {
        throw err;
      }
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

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error: AppError = new Error('User associated with session not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.status !== 'ACTIVE') {
      const error: AppError = new Error('This account is inactive. Contact the system administrator.');
      error.statusCode = 403;
      throw error;
    }

    const isCurrentValid = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      const error: AppError = new Error('Current password is incorrect.');
      error.statusCode = 401;
      throw error;
    }

    const isSamePassword = await comparePassword(input.newPassword, user.passwordHash);
    if (isSamePassword) {
      const error: AppError = new Error('New password must be different from the current password.');
      error.statusCode = 400;
      throw error;
    }

    const newPasswordHash = await hashPassword(input.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    });

    return {
      message: 'Password changed successfully. Please sign in again.',
    };
  }
}

export const authService = new AuthService();
