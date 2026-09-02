import { prisma, Role } from '../../lib/prisma';
import { hashPassword } from '../../lib/hash';
import { AppError } from '../../middleware/error.middleware';
import { CreateUserInput, UpdateUserInput } from './users.schema';

export class UsersService {
  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      const error: AppError = new Error(`User with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  async createUser(input: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      const error: AppError = new Error(`User with email '${input.email}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        status: input.status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async updateUser(id: string, input: UpdateUserInput) {
    await this.getUserById(id);

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.password) {
      updateData.passwordHash = await hashPassword(input.password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async deleteUser(id: string, requesterUserId?: string) {
    if (requesterUserId && id === requesterUserId) {
      const error: AppError = new Error('You cannot delete your own account while logged in.');
      error.statusCode = 400;
      throw error;
    }

    const user = await this.getUserById(id);

    if (user.role === Role.SUPER_ADMIN) {
      const superAdminCount = await prisma.user.count({
        where: { role: Role.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        const error: AppError = new Error('Cannot delete the last remaining Super Admin account.');
        error.statusCode = 400;
        throw error;
      }
    }

    return prisma.user.delete({
      where: { id },
    });
  }
}

export const usersService = new UsersService();
