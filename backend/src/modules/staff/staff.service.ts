import crypto from 'node:crypto';
import { hashPassword } from '../../lib/hash';
import { passwordPolicySchema } from '../../lib/passwordPolicy';
import { OneTimeSalaryPaymentInput } from './staff.schema';
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

export const isTeachingDesignation = (designation: string) => /\b(teacher|lecturer|instructor)\b/i.test(designation);
const portalSelect = { id: true, email: true, role: true, status: true } as const;
const paymentSelect = { id: true, amount: true, transactionDate: true, status: true, paymentMethod: true, referenceNumber: true, description: true, createdByName: true } as const;
function staffError(message: string, statusCode: number, code?: string): AppError & { code?: string } { return Object.assign(new Error(message), { statusCode, code }); }
export function teacherEmail(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 40).replace(/\.+$/g, '') || 'staff';
  return 'teacher.' + normalized + '.' + crypto.randomBytes(8).toString('hex') + '@azmaio.com';
}
async function lockStaff(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Staff" WHERE id = ${id} FOR UPDATE`;
  const staff = await tx.staff.findUnique({ where: { id } });
  if (!staff) throw staffError('Staff member not found.', 404);
  return staff;
}

export class StaffService {
  /**
   * Registers a new personnel / staff member profile.
   * Canonicalizes CNIC to 13 digits and checks both canonical and legacy variants for duplicate prevention.
   */
  async createStaff(input: CreateStaffInput) {
    const canonicalCnic = normalizeCnic(input.cnic);
    const teaching = isTeachingDesignation(input.role);
    const temporaryPassword = teaching ? crypto.randomBytes(24).toString('base64url') : null;
    const passwordHash = temporaryPassword ? await hashPassword(passwordPolicySchema.parse(temporaryPassword)) : null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const email = teaching ? teacherEmail(input.fullName) : null;
      try {
        return await prisma.$transaction(async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'staff-cnic:' + canonicalCnic}))`;
          const existing = await tx.staff.findFirst({ where: { cnic: { in: cnicVariants(canonicalCnic) } } });
          if (existing) throw staffError('A staff member with this CNIC is already registered.', 409);
          if (email && await tx.user.findUnique({ where: { email } })) throw staffError('Teacher email collision.', 409, 'EMAIL_COLLISION');
          const user = email && passwordHash ? await tx.user.create({ data: { name: input.fullName, email, passwordHash, role: 'TEACHER', status: 'ACTIVE' }, select: portalSelect }) : null;
          const staff = await tx.staff.create({ data: { fullName: input.fullName!, role: input.role!, phone: input.phone!, salary: input.salary!, cnic: canonicalCnic, status: 'ACTIVE', joinDate: input.joinDate || new Date(), userId: user?.id } });
          return { ...staff, ...(user ? { portalAccount: user, portalCredentials: { email: user.email, temporaryPassword: temporaryPassword!, role: 'TEACHER' as const } } : {}) };
        });
      } catch (error: any) {
        const emailCollision = error.code === 'EMAIL_COLLISION' || (error.code === 'P2002' && String(error.meta?.target).includes('email'));
        if (emailCollision && attempt < 4) continue;
        if (error.code === 'P2002' || emailCollision) throw staffError('Staff registration conflicts with an existing record. Please retry.', 409);
        throw error;
      }
    }
    throw staffError('Teacher account could not be created.', 409);
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
        user: { select: portalSelect },
        salaryPayments: { where: { source: 'STAFF_PAYMENT' }, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }], select: paymentSelect },
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

    const { user, ...record } = staff;
    return { ...record, portalAccount: user };
  }

  /**
   * Updates staff details with canonical CNIC normalization and collision safety.
   */
  async updateStaff(id: string, input: UpdateStaffInput) {
    try {
      return await prisma.$transaction(async tx => {
        const staff = await lockStaff(tx, id);
        const data = { ...input, ...(input.cnic ? { cnic: normalizeCnic(input.cnic) } : {}) };
        if (input.cnic) {
          const duplicate = await tx.staff.findFirst({ where: { id: { not: id }, cnic: { in: cnicVariants(data.cnic!) } } });
          if (duplicate) throw staffError('A staff member with this CNIC is already registered.', 409);
        }
        const updated = await tx.staff.update({ where: { id }, data });
        if (staff.userId) {
          const deactivate = (staff.status === 'ACTIVE' && updated.status === 'INACTIVE') || (isTeachingDesignation(staff.role) && !isTeachingDesignation(updated.role));
          const reactivate = staff.status === 'INACTIVE' && updated.status === 'ACTIVE' && isTeachingDesignation(updated.role);
          await tx.user.update({ where: { id: staff.userId }, data: {
            ...(input.fullName !== undefined ? { name: updated.fullName } : {}),
            ...(deactivate ? { status: 'INACTIVE', tokenVersion: { increment: 1 } } : reactivate ? { status: 'ACTIVE' } : {}),
          } });
        }
        return updated;
      });
    } catch (error: any) {
      if (error.code === 'P2002') throw staffError('A staff member with this CNIC is already registered.', 409);
      throw error;
    }
  }

  async deleteStaff(id: string) {
    try {
      return await prisma.$transaction(async tx => {
        const staff = await lockStaff(tx, id);
        if (staff.userId || await tx.transaction.count({ where: { relatedStaffId: id } }) || await tx.payrollRecord.count({ where: { staffId: id } })) {
          throw staffError('This staff member has account or payment history. Deactivate the staff member instead.', 409);
        }
        return tx.staff.delete({ where: { id } });
      });
    } catch (error: any) {
      if (error.code === 'P2003' || error.code === 'P2014') throw staffError('This staff member has account or payment history. Deactivate the staff member instead.', 409);
      throw error;
    }
  }

  async paySalaryOnce(id: string, input: OneTimeSalaryPaymentInput, actor: { userId: string; name?: string; email: string }, key: string) {
    const payload = { staffId: id, actorId: actor.userId, amount: new Prisma.Decimal(input.amount).toString(), paymentMethod: input.paymentMethod ?? null, referenceNumber: input.referenceNumber ?? null, note: input.note ?? null, paidAt: input.paidAt?.toISOString() ?? null };
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'staff-payment:' + key}))`;
      const prior = await tx.idempotencyRecord.findUnique({ where: { key } });
      if (prior) {
        if (prior.action !== 'STAFF_ONE_TIME_SALARY_PAYMENT') throw staffError('Idempotency-Key was already used for a different request.', 409);
        if (prior.expiresAt > new Date()) {
          if (prior.payloadHash !== payloadHash) throw staffError('Idempotency-Key was already used for a different request.', 409);
          return JSON.parse(prior.response);
        }
        // Only retire this action's expired key, atomically under the advisory lock.
        await tx.idempotencyRecord.delete({ where: { key } });
      }
      const staff = await lockStaff(tx, id);
      if (staff.status !== 'ACTIVE') throw staffError('Inactive staff cannot receive new salary payments.', 409);
      const payment = await tx.transaction.create({ data: {
        type: 'SALARY_EXPENSE', source: 'STAFF_PAYMENT', status: 'POSTED', relatedStaffId: id,
        amount: input.amount, transactionDate: input.paidAt || new Date(), category: 'Staff Salary',
        paymentMethod: input.paymentMethod, referenceNumber: input.referenceNumber,
        description: 'One-time salary payment — ' + staff.fullName + (input.note ? ' — ' + input.note : ''),
        createdById: actor.userId, createdByName: actor.name, createdByEmail: actor.email,
      }, select: paymentSelect });
      const response = JSON.parse(JSON.stringify(payment));
      await tx.idempotencyRecord.create({ data: { key, action: 'STAFF_ONE_TIME_SALARY_PAYMENT', payloadHash, response: JSON.stringify(response), statusCode: 201, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      return response;
    });
  }

  async exportTeachers() {
    // Complete authoritative query; never use the paginated frontend roster.
    const records = await prisma.staff.findMany({ orderBy: [{ fullName: 'asc' }, { id: 'asc' }], select: {
      id: true, fullName: true, role: true, phone: true, cnic: true, joinDate: true, status: true, salary: true, createdAt: true, user: { select: portalSelect },
    } });
    return records.filter(s => isTeachingDesignation(s.role)).map(({ user, ...s }) => ({ ...s, cnic: maskCnic(s.cnic), salary: s.salary.toString(), portalAccount: user }));
  }


}

export const staffService = new StaffService();
