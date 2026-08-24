import { prisma, PayrollStatus, TransactionType } from '../../lib/prisma';
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
   * Marks a staff member's payroll as paid and creates a corresponding SALARY_EXPENSE Transaction.
   */
  async markPayrollPaid(id: string, input: MarkPayrollPaidInput) {
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

    if (payroll.status === PayrollStatus.PAID) {
      const error: AppError = new Error(
        `Payroll record for '${payroll.staff?.fullName || 'Staff'}' (${payroll.month}) is already marked as paid.`
      );
      error.statusCode = 400;
      throw error;
    }

    const paidAt = input.paidAt || new Date();

    // 1. Update PayrollRecord status to PAID
    const updated = await prisma.payrollRecord.update({
      where: { id },
      data: {
        status: PayrollStatus.PAID,
        paidAt,
      },
      include: {
        staff: true,
      },
    });

    // 2. Create SALARY_EXPENSE Transaction record
    const staffName = updated.staff ? `${updated.staff.fullName} (${updated.staff.role})` : 'Staff';

    const transaction = await prisma.transaction.create({
      data: {
        type: TransactionType.SALARY_EXPENSE,
        amount: updated.amount,
        description: `Salary Disbursement - ${staffName} for month ${updated.month}`,
        relatedPayrollId: updated.id,
      },
    });

    return {
      message: `Payroll for ${staffName} marked as PAID. Disbursed: PKR ${updated.amount}`,
      payrollRecord: updated,
      transaction,
    };
  }

  /**
   * Retrieves paginated list of payroll records with filters.
   */
  async getPayrollList(query: PayrollQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
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
