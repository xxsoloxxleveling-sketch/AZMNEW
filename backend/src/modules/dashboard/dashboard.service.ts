import { prisma, TransactionType } from '../../lib/prisma';
import { TransactionStatus, Prisma } from '@prisma/client';
import { attendanceService } from '../attendance/attendance.service';

export class DashboardService {
  /**
   * Aggregates live system overview metrics across Students, Attendance, Fees, Staff, and Financial Flow
   * using optimized database-level queries with minimal Node.js memory footprint.
   */
  async getOverview() {
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}`;

    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );

    // 1. Fetch Students counts & demographics (selecting ONLY 3 lightweight enum/string columns)
    const [totalStudents, totalActiveStudents, demographics] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.student.findMany({
        select: {
          gender: true,
          currentClass: true,
          scholarshipCategory: true,
        },
      }),
    ]);

    // Student Demographics breakdown
    const byGender: Record<string, number> = {
      MALE: 0,
      FEMALE: 0,
      OTHER: 0,
    };
    const byClassLevel: Record<string, number> = {};
    const byScholarshipCategory: Record<string, number> = {};

    for (const student of demographics) {
      if (student.gender) {
        byGender[student.gender] = (byGender[student.gender] || 0) + 1;
      }
      if (student.currentClass) {
        byClassLevel[student.currentClass] = (byClassLevel[student.currentClass] || 0) + 1;
      }
      if (student.scholarshipCategory) {
        byScholarshipCategory[student.scholarshipCategory] =
          (byScholarshipCategory[student.scholarshipCategory] || 0) + 1;
      }
    }

    // Exam attendance uses frozen Hall session rosters, never global/class population.
    const attendanceToday = await attendanceService.getTodayAttendance(now);

    // 3. Fee Collection Aggregations via database SUM
    const [feeBilledAgg, feePaidAgg] = await Promise.all([
      prisma.feeRecord.aggregate({
        _sum: {
          amountDue: true,
        },
      }),
      prisma.feeRecord.aggregate({
        _sum: {
          amountPaid: true,
        },
      }),
    ]);

    const totalBilled = Number(feeBilledAgg._sum.amountDue || 0);
    const totalCollected = Number(feePaidAgg._sum.amountPaid || 0);
    const totalPendingFee = Math.max(0, totalBilled - totalCollected);
    const feeCollectionPercentage =
      totalBilled > 0
        ? parseFloat(((totalCollected / totalBilled) * 100).toFixed(1))
        : 0;

    // 4. Staff Aggregations
    const activeStaffCount = await prisma.staff.count({
      where: { status: 'ACTIVE' },
    });

    // 5. Financial Flow via database SUM aggregation (Strictly Current Calendar Month & POSTED only)
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    const txSums = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        status: TransactionStatus.POSTED,
        transactionDate: {
          gte: startOfMonth,
          lt: nextMonthStart,
        },
      },
      _sum: {
        amount: true,
      },
    });

    let monthFeeIncomeDec = new Prisma.Decimal(0);
    let monthSalaryExpenseDec = new Prisma.Decimal(0);
    let otherIncomeDec = new Prisma.Decimal(0);
    let otherExpenseDec = new Prisma.Decimal(0);

    for (const tx of txSums) {
      const txAmount = tx._sum.amount ? new Prisma.Decimal(tx._sum.amount) : new Prisma.Decimal(0);
      if (tx.type === TransactionType.FEE_INCOME) {
        monthFeeIncomeDec = monthFeeIncomeDec.plus(txAmount);
      } else if (tx.type === TransactionType.SALARY_EXPENSE) {
        monthSalaryExpenseDec = monthSalaryExpenseDec.plus(txAmount);
      } else if (tx.type === TransactionType.OTHER_INCOME) {
        otherIncomeDec = otherIncomeDec.plus(txAmount);
      } else if (tx.type === TransactionType.OTHER_EXPENSE) {
        otherExpenseDec = otherExpenseDec.plus(txAmount);
      }
    }

    const netCashFlowDec = monthFeeIncomeDec
      .plus(otherIncomeDec)
      .minus(monthSalaryExpenseDec)
      .minus(otherExpenseDec);

    const monthFeeIncome = Number(monthFeeIncomeDec);
    const monthSalaryExpense = Number(monthSalaryExpenseDec);
    const otherIncome = Number(otherIncomeDec);
    const otherExpense = Number(otherExpenseDec);
    const netCashFlow = Number(netCashFlowDec);

    // 6. Partner Institution Aggregations (Coalesced NULL-safe)
    const [
      totalPartners,
      pendingPartners,
      approvedPartners,
      rejectedPartners,
      partnerStrengthAgg,
      partnerApplicantsAgg,
    ] = await Promise.all([
      prisma.partnerInstitution.count(),
      prisma.partnerInstitution.count({ where: { status: 'PENDING' } }),
      prisma.partnerInstitution.count({ where: { status: 'APPROVED' } }),
      prisma.partnerInstitution.count({ where: { status: 'REJECTED' } }),
      prisma.partnerInstitution.aggregate({ _sum: { studentStrength: true } }),
      prisma.partnerInstitution.aggregate({ _sum: { expectedApplicants: true } }),
    ]);

    const totalPartnerStudents = Number(partnerStrengthAgg._sum.studentStrength ?? 0);
    const totalExpectedApplicants = Number(partnerApplicantsAgg._sum.expectedApplicants ?? 0);
// netCashFlow computed above via Prisma.Decimal

    return {
      period: {
        currentMonth,
        date: startOfToday.toISOString().split('T')[0],
      },
      stats: {
        totalStudents,
        totalActiveStudents,
        activeStaffCount,
        totalPartners,
        pendingPartners,
        approvedPartners,
        totalPartnerStudents,
        totalExpectedApplicants,
      },
      partnerStats: {
        totalPartners,
        pendingPartners,
        approvedPartners,
        rejectedPartners,
        totalPartnerStudents,
        totalExpectedApplicants,
      },
      attendanceToday,
      feeCollection: {
        totalBilled,
        totalCollected,
        totalPending: totalPendingFee,
        collectionPercentage: feeCollectionPercentage,
      },
      financialFlow: {
        month: currentMonth,
        feeIncome: monthFeeIncome,
        salaryExpenses: monthSalaryExpense,
        otherIncome,
        otherExpense,
        netCashFlow,
      },
      studentDemographics: {
        byGender,
        byClassLevel,
        byScholarshipCategory,
      },
    };
  }
}

export const dashboardService = new DashboardService();
