import { Prisma } from '@prisma/client';
import { prisma, Role } from '../../lib/prisma';
import { hashPassword } from '../../lib/hash';
import { AppError } from '../../middleware/error.middleware';
import { CreateUserInput, UpdateUserInput, UserQueryInput } from './users.schema';

/**
 * Execute a transaction client operation with Serializable isolation level and bounded retries.
 * Retries up to maxRetries on serialization conflict (P2034).
 */
async function withSerializableRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        attempt++;
        if (attempt >= maxRetries) {
          const error: AppError = new Error('A concurrent modification conflicted with this operation. Please retry.');
          error.statusCode = 409;
          throw error;
        }
        await new Promise((res) => setTimeout(res, 25 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  const error: AppError = new Error('A concurrent modification conflicted with this operation. Please retry.');
  error.statusCode = 409;
  throw error;
}

export class UsersService {
  async getUsers(query?: UserQueryInput) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.role) {
      where.role = query.role;
    }

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        {
          name: {
            contains: term,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: term,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [userRecords, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: userRecords,
      items: userRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
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
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const error: AppError = new Error('A user with this email already exists.');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await hashPassword(input.password);

    try {
      const user = await prisma.user.create({
        data: {
          name: input.name.trim(),
          email: normalizedEmail,
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
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const error: AppError = new Error('A user with this email already exists.');
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }
  }

  async countActiveSuperAdmins(): Promise<number> {
    return prisma.user.count({
      where: {
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
  }

  async updateUser(id: string, input: UpdateUserInput, requesterUserId?: string) {
    if (requesterUserId && id === requesterUserId && input.status === 'INACTIVE') {
      const error: AppError = new Error('You cannot deactivate your own account.');
      error.statusCode = 400;
      throw error;
    }

    const user = await this.getUserById(id);

    const isTargetActiveSuperAdmin = user.role === Role.SUPER_ADMIN && user.status === 'ACTIVE';
    const isDemoting = input.role !== undefined && input.role !== Role.SUPER_ADMIN;
    const isDeactivating = input.status === 'INACTIVE';
    const willReduceActiveSuperAdmin = isTargetActiveSuperAdmin && (isDemoting || isDeactivating);

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.role !== undefined) updateData.role = input.role;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.password) {
      updateData.passwordHash = await hashPassword(input.password);
    }

    const isSecuritySensitiveChange =
      (input.role !== undefined && input.role !== user.role) ||
      (input.status !== undefined && input.status !== user.status) ||
      Boolean(input.password);

    if (isSecuritySensitiveChange) {
      updateData.tokenVersion = { increment: 1 };
    }

    if (willReduceActiveSuperAdmin) {
      return withSerializableRetry(async (tx) => {
        const activeCount = await tx.user.count({
          where: {
            role: Role.SUPER_ADMIN,
            status: 'ACTIVE',
          },
        });

        if (activeCount <= 1) {
          const error: AppError = new Error(
            isDemoting
              ? 'You cannot change the role of the last active Super Admin.'
              : 'You cannot deactivate the last active Super Admin.'
          );
          error.statusCode = 409;
          throw error;
        }

        return tx.user.update({
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
      });
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

    if (user.role === Role.SUPER_ADMIN && user.status === 'ACTIVE') {
      return withSerializableRetry(async (tx) => {
        const activeCount = await tx.user.count({
          where: {
            role: Role.SUPER_ADMIN,
            status: 'ACTIVE',
          },
        });

        if (activeCount <= 1) {
          const error: AppError = new Error('Cannot delete the last remaining Super Admin account.');
          error.statusCode = 409;
          throw error;
        }

        return tx.user.delete({
          where: { id },
        });
      });
    }

    return prisma.user.delete({
      where: { id },
    });
  }
}

export const usersService = new UsersService();
