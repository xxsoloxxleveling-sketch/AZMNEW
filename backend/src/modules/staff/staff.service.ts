import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateStaffInput, UpdateStaffInput, StaffQueryInput } from './staff.schema';
import { AppError } from '../../middleware/error.middleware';

/**
 * Normalizes a validated 13-digit Pakistani CNIC to its canonical digits-only representation.
 * E.g. "12345-1234567-1" or "1234512345671" -> "1234512345671"
 */
export function normalizeCnic(cnic: string): string {
  const digits = cnic.replace(/\D/g, '');
  if (digits.length !== 13) {
    throw new Error('Invalid CNIC: must contain exactly 13 digits');
  }
  return digits;
}

/**
 * Returns both canonical digits-only and standard hyphenated variants of a 13-digit CNIC.
 * Used for backward-compatible duplicate detection against legacy database rows.
 * E.g. "1234512345671" -> ["1234512345671", "12345-1234567-1"]
 */
export function cnicVariants(canonicalCnic: string): string[] {
  const digits = canonicalCnic.replace(/\D/g, '');
  if (digits.length !== 13) {
    return [canonicalCnic];
  }
  const hyphenated = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  return [digits, hyphenated];
}

/**
 * Masks Pakistani National Identity Card (CNIC) for directory privacy.
 * Retains first 5 geographic code digits and last checksum digit, masking the 7 personal sequence digits.
 * Supports both canonical digits-only and legacy hyphenated representations.
 * E.g. "1234512345671" or "12345-1234567-1" -> "12345-*******-1"
 */
export function maskCnic(cnic: string): string {
  if (!cnic) return '';
  const digits = cnic.replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-*******-${digits.slice(12)}`;
  }
  if (cnic.length > 5) {
    return `${cnic.slice(0, 3)}****${cnic.slice(-2)}`;
  }
  return '*****';
}

export class StaffService {
  /**
   * Registers a new personnel / staff member profile.
   * Canonicalizes CNIC to 13 digits and checks both canonical and legacy variants for duplicate prevention.
   */
  async createStaff(input: CreateStaffInput) {
    const canonicalCnic = normalizeCnic(input.cnic);
    const variants = cnicVariants(canonicalCnic);

    const existing = await prisma.staff.findFirst({
      where: {
        cnic: { in: variants },
      },
    });

    if (existing) {
      const error: AppError = new Error(
        `Staff member with CNIC '${input.cnic}' is already registered (${existing.fullName}).`
      );
      error.statusCode = 409;
      throw error;
    }

    try {
      const staff = await prisma.staff.create({
        data: {
          ...input,
          cnic: canonicalCnic,
          status: 'ACTIVE',
          joinDate: input.joinDate || new Date(),
        },
      });

      return staff;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const error: AppError = new Error(
          `Staff member with CNIC '${input.cnic}' is already registered.`
        );
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }
  }

  /**
   * Retrieves paginated staff members list with server-driven search & filter.
   * Performs data minimization: raw CNIC is masked and salary is excluded from bulk directory.
   */
  async getStaffList(query: StaffQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StaffWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.role?.trim()) {
      where.role = {
        contains: query.role.trim(),
        mode: 'insensitive',
      };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      const strippedCnicTerm = term.replace(/-/g, '');

      const orConditions: Prisma.StaffWhereInput[] = [
        {
          fullName: {
            contains: term,
            mode: 'insensitive',
          },
        },
        {
          role: {
            contains: term,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: term,
          },
        },
        {
          cnic: {
            contains: term,
          },
        },
      ];

      // If search query has hyphens and digits (e.g. "12345-123" or "12345-1234567-1"),
      // also match the stripped digits against canonical digits-only stored CNICs
      if (strippedCnicTerm !== term && /^\d+$/.test(strippedCnicTerm)) {
        orConditions.push({
          cnic: {
            contains: strippedCnicTerm,
          },
        });
      }

      where.OR = orConditions;
    }

    const [staffRecords, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          role: true,
          cnic: true,
          phone: true,
          joinDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.staff.count({ where }),
    ]);

    const staff = staffRecords.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      role: s.role,
      cnic: maskCnic(s.cnic),
      phone: s.phone,
      joinDate: s.joinDate,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

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
   * Retrieves a single staff member by ID including full payroll history and raw compensation data.
   * Accessible only to authorized administrative roles.
   */
  async getStaffById(id: string) {
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        payroll: {
          orderBy: { createdAt: 'desc' },
        },
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
   * Updates staff details with canonical CNIC normalization and collision safety.
   */
  async updateStaff(id: string, input: UpdateStaffInput) {
    await this.getStaffById(id);

    const dataToUpdate: any = { ...input };

    if (input.cnic) {
      const canonicalCnic = normalizeCnic(input.cnic);
      const variants = cnicVariants(canonicalCnic);

      const existing = await prisma.staff.findFirst({
        where: {
          cnic: { in: variants },
        },
      });

      if (existing && existing.id !== id) {
        const error: AppError = new Error(
          `Staff member with CNIC '${input.cnic}' is already registered (${existing.fullName}).`
        );
        error.statusCode = 409;
        throw error;
      }

      dataToUpdate.cnic = canonicalCnic;
    }

    try {
      const updated = await prisma.staff.update({
        where: { id },
        data: dataToUpdate,
      });

      return updated;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const error: AppError = new Error(
          `Staff member with CNIC '${input.cnic}' is already registered.`
        );
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }
  }

  /**
   * Deletes a staff record safely.
   * Blocks deletion if historical payroll records exist to protect the financial audit trail.
   */
  async deleteStaff(id: string) {
    await this.getStaffById(id);

    const payrollCount = await prisma.payrollRecord.count({
      where: { staffId: id },
    });

    if (payrollCount > 0) {
      const error: AppError = new Error(
        'This staff member has payroll history and cannot be deleted. Set the staff member to Inactive instead.'
      );
      error.statusCode = 409;
      throw error;
    }

    try {
      return await prisma.staff.delete({
        where: { id },
      });
    } catch (err: any) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2003' || err.code === 'P2014')
      ) {
        const error: AppError = new Error(
          'This staff member has payroll history and cannot be deleted. Set the staff member to Inactive instead.'
        );
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }
  }
}

export const staffService = new StaffService();
