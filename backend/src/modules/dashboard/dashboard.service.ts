import { prisma, TransactionType } from '../../lib/prisma';

export class DashboardService {
  /**
   * Aggregates live system overview metrics across Students, Attendance, Fees, Staff, and Financial Flow.
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

    // 1. Fetch Students data & demographics
    const [allStudents, totalActiveStudents] = await Promise.all([
      prisma.student.findMany(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
    ]);

    const totalStudents = allStudents.length;

    // Student Demographics breakdown
    const byGender: Record<string, number> = {
      MALE: 0,
      FEMALE: 0,
      OTHER: 0,
    };
    const byClassLevel: Record<string, number> = {};
    const byScholarshipCategory: Record<string, number> = {};

    for (const student of allStudents) {
      // Gender count
      if (student.gender) {
        byGender[student.gender] = (byGender[student.gender] || 0) + 1;
      }
      // Class Level count
      if (student.currentClass) {
        byClassLevel[student.currentClass] = (byClassLevel[student.currentClass] || 0) + 1;
      }
      // Scholarship Category count
      if (student.scholarshipCategory) {
        byScholarshipCategory[student.scholarshipCategory] =
          (byScholarshipCategory[student.scholarshipCategory] || 0) + 1;
      }
    }

    // 2. Today's Attendance Aggregations
    const todayRecords = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    for (const record of todayRecords) {
      if (record.status === 'PRESENT') presentCount++;
      else if (record.status === 'LATE') lateCount++;
      else if (record.status === 'ABSENT') absentCount++;
    }

    const todayMarkedCount = todayRecords.length;
    const todayAttendancePercentage =
      totalActiveStudents > 0
        ? parseFloat((((presentCount + lateCount) / totalActiveStudents) * 100).toFixed(1))
        : 0;

    // 3. Fee Collection Aggregations
    const allFeeRecords = await prisma.feeRecord.findMany();
    let totalBilled = 0;
    let totalCollected = 0;

    for (const fee of allFeeRecords) {
      totalBilled += Number(fee.amountDue || 0);
      totalCollected += Number(fee.amountPaid || 0);
    }

    const totalPendingFee = Math.max(0, totalBilled - totalCollected);
    const feeCollectionPercentage =
      totalBilled > 0
        ? parseFloat(((totalCollected / totalBilled) * 100).toFixed(1))
        : 0;

    // 4. Staff Aggregations
    const activeStaffCount = await prisma.staff.count({
      where: { status: 'ACTIVE' },
    });

    // 5. Financial Flow (Transactions for Current Month)
    const allTransactions = await prisma.transaction.findMany();

    let monthFeeIncome = 0;
    let monthSalaryExpense = 0;
    let otherIncome = 0;
    let otherExpense = 0;

    for (const tx of allTransactions) {
      const txAmount = Number(tx.amount || 0);
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
