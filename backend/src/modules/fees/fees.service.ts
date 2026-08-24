import { prisma, FeeStatus, TransactionType } from '../../lib/prisma';
import { qrService } from '../attendance/qr.service';
import { supabaseStorage } from '../../lib/supabaseStorage';
import { GenerateChallanInput, MarkPaidInput, FeeQueryInput } from './fees.schema';
import { AppError } from '../../middleware/error.middleware';

export class FeesService {
  /**
   * Generates sequential Challan Number in format CHL-YYYY-MM-XXXX
   */
  async generateChallanNumber(month: string): Promise<string> {
    const prefix = `CHL-${month}-`;
    const total = await prisma.feeRecord.count({
      where: {
        challanNumber: {
          startsWith: prefix,
        },
      },
    });

    const sequence = (total + 1).toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generates fee challans for a single student or in bulk for an entire class.
   */
  async generateChallans(input: GenerateChallanInput) {
    const dueDate =
      input.dueDate ||
      new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days default

    // Case 1: Single Student Challan Generation
    if (input.studentId) {
      const student = await prisma.student.findUnique({
        where: { id: input.studentId },
      });

      if (!student) {
        const error: AppError = new Error(`Student with ID '${input.studentId}' not found.`);
        error.statusCode = 404;
        throw error;
      }

      // Check for duplicate challan for the same student & month
      const existing = await prisma.feeRecord.findFirst({
        where: {
          studentId: input.studentId,
          month: input.month,
        },
      });

      if (existing) {
        const error: AppError = new Error(
          `A fee challan for student '${student.fullName}' for month '${input.month}' already exists (Challan #${existing.challanNumber}).`
        );
        error.statusCode = 409;
        throw error;
      }

      const challanNumber = await this.generateChallanNumber(input.month);

      const fee = await prisma.feeRecord.create({
        data: {
          studentId: student.id,
          month: input.month,
          amountDue: input.amountDue,
          amountPaid: 0,
          status: FeeStatus.UNPAID,
          challanNumber,
          dueDate,
        },
        include: {
          student: true,
        },
      });

      return {
        message: `Fee challan generated successfully for ${student.fullName}`,
        challans: [fee],
        count: 1,
      };
    }

    // Case 2: Bulk Generation for an entire class
    if (input.currentClass) {
      const students = await prisma.student.findMany({
        where: {
          currentClass: input.currentClass,
          status: 'ACTIVE',
        },
      });

      if (students.length === 0) {
        const error: AppError = new Error(
          `No active students found in class '${input.currentClass}'.`
        );
        error.statusCode = 404;
        throw error;
      }

      const createdChallans: any[] = [];

      for (const student of students) {
        const existing = await prisma.feeRecord.findFirst({
          where: {
            studentId: student.id,
            month: input.month,
          },
        });

        if (!existing) {
          const challanNumber = await this.generateChallanNumber(input.month);
          const fee = await prisma.feeRecord.create({
            data: {
              studentId: student.id,
              month: input.month,
              amountDue: input.amountDue,
              amountPaid: 0,
              status: FeeStatus.UNPAID,
              challanNumber,
              dueDate,
            },
            include: {
              student: true,
            },
          });
          createdChallans.push(fee);
        }
      }

      return {
        message: `Generated ${createdChallans.length} challans for class '${input.currentClass}' for month '${input.month}'`,
        challans: createdChallans,
        count: createdChallans.length,
      };
    }

    throw new Error('Invalid input');
  }

  /**
   * Marks a fee challan as paid and automatically creates a corresponding FEE_INCOME Transaction record.
   */
  async markFeePaid(feeId: string, input: MarkPaidInput) {
    const fee = await prisma.feeRecord.findUnique({
      where: { id: feeId },
      include: { student: true },
    });

    if (!fee) {
      const error: AppError = new Error(`Fee record with ID '${feeId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (fee.status === FeeStatus.PAID) {
      const error: AppError = new Error(
        `Fee challan #${fee.challanNumber} is already fully paid.`
      );
      error.statusCode = 400;
      throw error;
    }

    const currentPaid = Number(fee.amountPaid || 0);
    const amountDue = Number(fee.amountDue);
    const remainingBalance = Math.max(0, amountDue - currentPaid);

    const paymentAmount = input.amountPaid !== undefined ? input.amountPaid : remainingBalance;

    if (paymentAmount <= 0) {
      const error: AppError = new Error('Payment amount must be greater than 0.');
      error.statusCode = 400;
      throw error;
    }

    const newTotalPaid = currentPaid + paymentAmount;
    const newStatus: FeeStatus =
      newTotalPaid >= amountDue ? FeeStatus.PAID : FeeStatus.PARTIAL;

    const paidAt = input.paidAt || new Date();

    // 1. Update the FeeRecord
    const updatedFee = await prisma.feeRecord.update({
      where: { id: feeId },
      data: {
        amountPaid: newTotalPaid,
        status: newStatus,
        paidAt,
      },
      include: {
        student: true,
      },
    });

    // 2. If student does not have a Roll Number yet, assign sequential Roll Number and generate Biometric QR Code
    if (newStatus === FeeStatus.PAID && updatedFee.student && !updatedFee.student.rollNumber) {
      const year = new Date().getFullYear();
      const prefix = `AZMVS-${year}-`;
      const totalInYear = await prisma.student.count({
        where: { rollNumber: { startsWith: prefix } },
      });
      const rollNumber = `${prefix}${(totalInYear + 1).toString().padStart(4, '0')}`;


      const qrToken = qrService.generateSignedQrToken(rollNumber);
      const qrPayload = `https://jadoon.edu.pk/attend?token=${qrToken}`;
      const qrImageUrl = await qrService.generateQrDataUrl(qrPayload);

      await supabaseStorage.uploadFile('qr-codes', `${rollNumber}-qr.png`, qrImageUrl, 'image/png');

      await prisma.student.update({
        where: { id: updatedFee.studentId },
        data: {
          rollNumber,
          qrToken,
          qrImageUrl,
          officeUse: {
            upsert: {
              create: {
                testRollNo: rollNumber,
                eligibility: 'ELIGIBLE',
                finalStatus: 'SHORTLISTED',
                testCentre: 'Jadoon Public School & College Exam Centre',
                testReportingTime: '09:00 AM',
              },
              update: {
                testRollNo: rollNumber,
              },
            },
          },
        },
      });

      updatedFee.student.rollNumber = rollNumber;
    }

    // 3. Create the corresponding FEE_INCOME Transaction record
    const studentInfo = updatedFee.student
      ? `${updatedFee.student.fullName} (${updatedFee.student.rollNumber || updatedFee.student.id})`
      : 'Student';

    const transaction = await prisma.transaction.create({
      data: {
        type: TransactionType.FEE_INCOME,
        amount: paymentAmount,
        description: `Fee Collection - Challan #${fee.challanNumber} (${studentInfo} for month ${fee.month})`,
        relatedFeeId: fee.id,
      },
    });

    return {
      message: `Challan #${fee.challanNumber} marked as ${newStatus}. Received: PKR ${paymentAmount}`,
      feeRecord: updatedFee,
      transaction,
    };
  }

  /**
   * Retrieves paginated fee records with optional filters.
   */
  async getFees(query: FeeQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.month) where.month = query.month;
    if (query.status) where.status = query.status;

    const [feeRecords, total] = await Promise.all([
      prisma.feeRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
        },
      }),
      prisma.feeRecord.count({ where }),
    ]);

    return {
      feeRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single fee record by ID.
   */
  async getFeeById(id: string) {
    const fee = await prisma.feeRecord.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!fee) {
      const error: AppError = new Error(`Fee record with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const transaction = await prisma.transaction.findFirst({
      where: { relatedFeeId: id },
    });

    return {
      ...fee,
      transaction,
    };
  }

  /**
   * Aggregates fee overview metrics (collection rate %, outstanding amounts, counts by status).
   */
  async getFeeOverview(month?: string) {
    const where: any = {};
    if (month) where.month = month;

    const [allFees, transactions] = await Promise.all([
      prisma.feeRecord.findMany({
        where,
        include: { student: true },
      }),
      prisma.transaction.findMany({
        where: { type: TransactionType.FEE_INCOME },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    let totalAmountDue = 0;
    let totalAmountPaid = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let overdueCount = 0;

    const now = new Date();

    for (const f of allFees) {
      const due = Number(f.amountDue || 0);
      const paid = Number(f.amountPaid || 0);
      totalAmountDue += due;
      totalAmountPaid += paid;

      if (f.status === FeeStatus.PAID) {
        paidCount++;
      } else if (f.status === FeeStatus.PARTIAL) {
        partialCount++;
      } else if (f.status === FeeStatus.UNPAID) {
        if (new Date(f.dueDate) < now) {
          overdueCount++;
        } else {
          unpaidCount++;
        }
      } else if (f.status === FeeStatus.OVERDUE) {
        overdueCount++;
      }
    }

    const totalChallans = allFees.length;
    const totalPendingAmount = Math.max(0, totalAmountDue - totalAmountPaid);
    const collectionPercentage =
      totalAmountDue > 0
        ? parseFloat(((totalAmountPaid / totalAmountDue) * 100).toFixed(1))
        : 0;

    return {
      filterMonth: month || 'ALL_TIME',
      summary: {
        totalChallans,
        totalAmountDue,
        totalAmountPaid,
        totalPendingAmount,
        collectionPercentage,
      },
      statusBreakdown: {
        paid: paidCount,
        partial: partialCount,
        unpaid: unpaidCount,
        overdue: overdueCount,
      },
      recentFeeTransactions: transactions,
    };
  }
}

export const feesService = new FeesService();
