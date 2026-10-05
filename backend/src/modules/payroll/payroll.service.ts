import crypto from 'crypto';
import { prisma, PayrollStatus, TransactionType } from '../../lib/prisma';
import { TransactionStatus, TransactionSource } from '@prisma/client';
import { RunPayrollInput, MarkPayrollPaidInput, PayrollQueryInput } from './payroll.schema';
import { AppError } from '../../middleware/error.middleware';

export class PayrollService {
  /**
   * Generates month's payroll records for all active staff members.
   */
  async runPayroll(input: RunPayrollInput) {
    const activeStaff = await prisma.staff.findMany({
      where: { status: 'ACTIVE' },
    });

    if (activeStaff.length === 0) {
      const error: AppError = new Error('No active staff members found to generate payroll.');
      error.statusCode = 404;
      throw error;
    }

    const createdRecords: any[] = [];
    let skippedCount = 0;
    let totalLiability = 0;

    for (const staff of activeStaff) {
      const existing = await prisma.payrollRecord.findFirst({
        where: {
          staffId: staff.id,
          month: input.month,
        },
      });

      if (!existing) {
        const record = await prisma.payrollRecord.create({
          data: {
            staffId: staff.id,
            month: input.month,
            amount: staff.salary,
            status: PayrollStatus.PENDING,
          },
          include: {
            staff: true,
          },
        });
        createdRecords.push(record);
        totalLiability += Number(staff.salary);
      } else {
        skippedCount++;
        totalLiability += Number(existing.amount);
      }
    }

    return {
      message: `Payroll run completed for ${input.month}. Generated ${createdRecords.length} records (${skippedCount} already existed).`,
      month: input.month,
      createdCount: createdRecords.length,
      skippedCount,
      totalLiability,
      records: createdRecords,
    };
  }

  /**
   * Marks a staff member's payroll as paid and atomically creates a corresponding SALARY_EXPENSE Transaction.
   * Guarantees atomic execution, compare-and-swap concurrency protection, and persistent idempotency.
   */
  async markPayrollPaid(
    id: string,
    input: MarkPayrollPaidInput,
    actor?: { id: string; name?: string | null; email: string },
    idempotencyKey?: string
  ) {
    const idempotencyPayload = {
      action: 'PAYROLL_SETTLEMENT',
      requestPath: `/api/payroll/${id}/mark-paid`,
      payrollId: id,
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber,
      actorId: actor?.id,
    };
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(idempotencyPayload))
      .digest('hex');

    // 1. Check Idempotency Key if supplied by client
    if (idempotencyKey) {
      const existingIdemp = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (existingIdemp && existingIdemp.expiresAt > new Date()) {
        if (
          existingIdemp.action === 'PAYROLL_SETTLEMENT' &&
          existingIdemp.payloadHash === payloadHash
        ) {
          return JSON.parse(existingIdemp.response);
        } else {
          const conflictErr: AppError = new Error(
            'Idempotency key has already been used for a different request.'
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      const payroll = await tx.payrollRecord.findUnique({
        where: { id },
        include: {
          staff: true,
        },
      });

      if (!payroll) {
        const error: AppError = new Error(`Payroll record with ID '${id}' not found.`);
        error.statusCode = 404;
        throw error;
      }

      if (payroll.status === PayrollStatus.PAID) {
        const error: AppError = new Error(
          `Payroll record for '${payroll.staff?.fullName || 'Staff'}' (${payroll.month}) is already marked as paid.`
        );
        error.statusCode = 409;
        throw error;
      }

      const paidAt = input.paidAt || new Date();

      // Atomic conditional update to guard against concurrent double-submits
      const updateRes = await tx.payrollRecord.updateMany({
        where: {
          id,
          status: PayrollStatus.PENDING,
        },
        data: {
          status: PayrollStatus.PAID,
          paidAt,
        },
      });

      if (updateRes.count === 0) {
        const error: AppError = new Error(
          `Payroll record for '${payroll.staff?.fullName || 'Staff'}' (${payroll.month}) has already been paid concurrently.`
        );
        error.statusCode = 409;
        throw error;
      }

      const updated = await tx.payrollRecord.findUnique({
        where: { id },
        include: {
          staff: true,
        },
      });

      const staffName = updated?.staff
        ? `${updated.staff.fullName} (${updated.staff.role})`
        : 'Staff';

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.SALARY_EXPENSE,
          amount: updated!.amount,
          description: `Salary Disbursement - ${staffName} for month ${updated!.month}`,
          transactionDate: paidAt,
          status: TransactionStatus.POSTED,
          source: TransactionSource.PAYROLL,
          relatedPayrollId: updated!.id,
          createdById: actor?.id || null,
          createdByName: actor?.name || actor?.email || null,
          createdByEmail: actor?.email || null,
        },
      });

      const responseData = {
        message: `Payroll for ${staffName} marked as PAID. Disbursed: PKR ${updated!.amount}`,
        payrollRecord: updated,
        transaction: {
          ...transaction,
          amount: transaction.amount.toString(),
        },
      };

      if (idempotencyKey) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await tx.idempotencyRecord.upsert({
          where: { key: idempotencyKey },
          update: {
            action: 'PAYROLL_SETTLEMENT',
            payloadHash,
            response: JSON.stringify(responseData),
            expiresAt,
          },
          create: {
            key: idempotencyKey,
            action: 'PAYROLL_SETTLEMENT',
            payloadHash,
            statusCode: 200,
            response: JSON.stringify(responseData),
            expiresAt,
          },
        });
      }

      return responseData;
    });
  }

  /**
   * Retrieves paginated list of payroll records with filters.
   */
  async getPayrollList(query: PayrollQueryInput) {
    const page = parseInt(String(query.page || 1), 10) || 1;
    const limit = parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.month) where.month = query.month;
    if (query.status) where.status = query.status;
    if (query.staffId) where.staffId = query.staffId;

    const [payrollRecords, total] = await Promise.all([
      prisma.payrollRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: true,
        },
      }),
      prisma.payrollRecord.count({ where }),
    ]);

    return {
      payrollRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single payroll record by ID with staff and transaction details.
   */
  async getPayrollById(id: string) {
    const payroll = await prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        staff: true,
      },
    });

    if (!payroll) {
      const error: AppError = new Error(`Payroll record with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const transaction = await prisma.transaction.findFirst({
      where: { relatedPayrollId: id },
    });

    return {
      ...payroll,
      transaction,
    };
  }

  /**
   * Aggregates payroll summary metrics (total liability, disbursed %, pending amount).
   */
  async getPayrollOverview(month?: string) {
    const where: any = {};
    if (month) where.month = month;

    const [allRecords, recentTransactions] = await Promise.all([
      prisma.payrollRecord.findMany({
        where,
        include: { staff: true },
      }),
      prisma.transaction.findMany({
        where: { type: TransactionType.SALARY_EXPENSE },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    let totalPayrollAmount = 0;
    let totalPaidAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;

    for (const r of allRecords) {
      const amt = Number(r.amount || 0);
      totalPayrollAmount += amt;

      if (r.status === PayrollStatus.PAID) {
        totalPaidAmount += amt;
        paidCount++;
      } else {
        pendingCount++;
      }
    }

    const totalPendingAmount = Math.max(0, totalPayrollAmount - totalPaidAmount);
    const disbursementPercentage =
      totalPayrollAmount > 0
        ? parseFloat(((totalPaidAmount / totalPayrollAmount) * 100).toFixed(1))
        : 0;

    return {
      filterMonth: month || 'ALL_TIME',
      summary: {
        totalRecords: allRecords.length,
        totalPayrollAmount,
        totalPaidAmount,
        totalPendingAmount,
        disbursementPercentage,
      },
      statusBreakdown: {
        paidCount,
        pendingCount,
      },
      recentSalaryTransactions: recentTransactions,
    };
  }
}

export const payrollService = new PayrollService();
