import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { UserQueryInput } from './users.schema';

export class UsersController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.getUsers(req.query as unknown as UserQueryInput);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getUserById(req.params.id);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.createUser(req.body);
      res.status(201).json({
        success: true,
        message: 'User account created successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await usersService.updateUser(req.params.id, req.body, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'User account updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await usersService.deleteUser(req.params.id, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'User account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
