import { prisma, TransactionType } from '../../lib/prisma';

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

    // 2. Today's Attendance Counts via efficient database aggregation
    const [presentCount, lateCount, absentCount] = await Promise.all([
      prisma.attendance.count({
        where: {
          date: { gte: startOfToday, lte: endOfToday },
          status: 'PRESENT',
        },
      }),
      prisma.attendance.count({
        where: {
          date: { gte: startOfToday, lte: endOfToday },
          status: 'LATE',
        },
      }),
      prisma.attendance.count({
        where: {
          date: { gte: startOfToday, lte: endOfToday },
          status: 'ABSENT',
        },
      }),
    ]);

    const todayMarkedCount = presentCount + lateCount + absentCount;
    const todayAttendancePercentage =
      totalActiveStudents > 0
        ? parseFloat((((presentCount + lateCount) / totalActiveStudents) * 100).toFixed(1))
        : 0;

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

    // 5. Financial Flow via database SUM aggregation
    const txSums = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: {
        amount: true,
      },
    });

    let monthFeeIncome = 0;
    let monthSalaryExpense = 0;
    let otherIncome = 0;
    let otherExpense = 0;

    for (const tx of txSums) {
      const txAmount = Number(tx._sum.amount || 0);
      if (tx.type === TransactionType.FEE_INCOME) {
        monthFeeIncome += txAmount;
      } else if (tx.type === TransactionType.SALARY_EXPENSE) {
        monthSalaryExpense += txAmount;
      } else if (tx.type === TransactionType.OTHER_INCOME) {
        otherIncome += txAmount;
      } else if (tx.type === TransactionType.OTHER_EXPENSE) {
        otherExpense += txAmount;
      }
    }

    const netCashFlow = monthFeeIncome + otherIncome - (monthSalaryExpense + otherExpense);

    return {
      period: {
        currentMonth,
        date: startOfToday.toISOString().split('T')[0],
      },
      stats: {
        totalStudents,
        totalActiveStudents,
        activeStaffCount,
      },
      attendanceToday: {
        totalActiveStudents,
        markedCount: todayMarkedCount,
        presentCount,
        lateCount,
        absentCount,
        unmarkedCount: Math.max(0, totalActiveStudents - todayMarkedCount),
        attendancePercentage: todayAttendancePercentage,
      },
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
