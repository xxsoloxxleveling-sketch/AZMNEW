import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = authService.logout();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async testProtected(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        success: true,
        message: 'Protected route accessed successfully',
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async superAdminOnly(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        success: true,
        message: 'Super admin only route accessed successfully',
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
