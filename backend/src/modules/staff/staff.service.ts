import { prisma } from '../../lib/prisma';
import { CreateStaffInput, UpdateStaffInput, StaffQueryInput } from './staff.schema';
import { AppError } from '../../middleware/error.middleware';

export class StaffService {
  /**
   * Registers a new staff member.
   */
  async createStaff(input: CreateStaffInput) {
    const existing = await prisma.staff.findUnique({
      where: { cnic: input.cnic },
    });

    if (existing) {
      const error: AppError = new Error(
        `Staff member with CNIC '${input.cnic}' is already registered (${existing.fullName}).`
      );
      error.statusCode = 409;
      throw error;
    }

    const staff = await prisma.staff.create({
      data: {
        ...input,
        status: 'ACTIVE',
        joinDate: input.joinDate || new Date(),
      },
    });

    return staff;
  }

  /**
   * Retrieves paginated staff members list with optional search & filter.
   */
  async getStaffList(query: StaffQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.role) where.role = query.role;
    if (query.search) where.search = query.search;

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.staff.count({ where }),
    ]);

    return {
      staff,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single staff member by ID including payroll history.
   */
  async getStaffById(id: string) {
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        payroll: true,
      },
    });

    if (!staff) {
      const error: AppError = new Error(`Staff member with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return staff;
  }

  /**
   * Updates staff details.
   */
  async updateStaff(id: string, input: UpdateStaffInput) {
    await this.getStaffById(id);

    const updated = await prisma.staff.update({
      where: { id },
      data: input,
    });

    return updated;
  }

  /**
   * Deletes a staff record.
   */
  async deleteStaff(id: string) {
    await this.getStaffById(id);

    return prisma.staff.delete({
      where: { id },
    });
  }
}

export const staffService = new StaffService();
