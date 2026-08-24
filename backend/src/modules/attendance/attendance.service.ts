import { prisma, AttendanceMethod } from '../../lib/prisma';
import { qrService } from './qr.service';
import { ScanAttendanceInput, TodayAttendanceQueryInput } from './attendance.schema';
import { AppError } from '../../middleware/error.middleware';

export class AttendanceService {
  /**
   * Unified endpoint for marking attendance via QR scan or manual search fallback.
   * Enforces the one-record-per-student-per-day constraint.
   */
  async scanOrMarkAttendance(input: ScanAttendanceInput, markedByUserId: string) {
    let student = null;
    let method: AttendanceMethod = AttendanceMethod.MANUAL;

    // 1. Resolve student by QR token or manual identifier
    if (input.qrToken && input.qrToken.trim()) {
      const token = input.qrToken.trim();
      const isValidSignature = qrService.verifySignedQrToken(token);

      if (!isValidSignature) {
        const error: AppError = new Error('Invalid or forged QR token signature.');
        error.statusCode = 400;
        throw error;
      }

      student = await prisma.student.findUnique({
        where: { qrToken: token },
      });
      method = AttendanceMethod.QR_SCAN;
    } else if (input.rollNumber && input.rollNumber.trim()) {
      student = await prisma.student.findUnique({
        where: { rollNumber: input.rollNumber.trim() },
      });
      method = AttendanceMethod.MANUAL;
    } else if (input.studentId && input.studentId.trim()) {
      student = await prisma.student.findUnique({
        where: { id: input.studentId.trim() },
      });
      method = AttendanceMethod.MANUAL;
    }

    if (!student) {
      const error: AppError = new Error('Student not found for the provided QR code or identifier.');
      error.statusCode = 404;
      throw error;
    }

    // 2. Validate student is active
    if (student.status !== 'ACTIVE') {
      const error: AppError = new Error(
        `Cannot mark attendance for inactive student '${student.fullName}' (Status: ${student.status}).`
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Normalize date for strict one-record-per-day constraint
    const targetDate = input.date ? new Date(input.date) : new Date();
    const startOfDay = new Date(
      Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfDay = new Date(
      Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999)
    );

    // 4. Check if student already has an attendance record for this day
    const existing = await prisma.attendance.findFirst({
      where: {
        studentId: student.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existing) {
      const error: AppError = new Error(
        `Attendance already marked today for '${student.fullName}' (${student.rollNumber || student.id}) as ${existing.status} via ${existing.method}. Duplicate check failed.`
      );
      error.statusCode = 409;
      throw error;
    }

    // 5. Create Attendance record (Database unique constraint @@unique([studentId, date]) guarantees safety)
    try {
      const record = await prisma.attendance.create({
        data: {
          studentId: student.id,
          date: startOfDay,
          status: input.status,
          method,
          markedByUserId,
        },
      });

      return {
        attendance: record,
        student: {
          id: student.id,
          fullName: student.fullName,
          fatherName: student.fatherName,
          rollNumber: student.rollNumber,
          currentClass: student.currentClass,
          photoUrl: student.photoUrl,
          status: student.status,
        },
        message: `Attendance marked successfully as ${input.status} (${method === AttendanceMethod.QR_SCAN ? 'QR Scan' : 'Manual Entry'})`,
      };
    } catch (err: any) {
      if (err.code === 'P2002' || (err.message && err.message.includes('Unique constraint'))) {
        const error: AppError = new Error(
          `Attendance already marked for student '${student.fullName}' on this date.`
        );
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }
  }

  /**
   * Retrieves today's attendance summary and records list.
   */
  async getTodayAttendance(query: TodayAttendanceQueryInput = {}) {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );

    const where: any = {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (query?.status) where.status = query.status;
    if (query?.method) where.method = query.method;
    if (query?.classLevel) where.student = { currentClass: query.classLevel };

    const [records, totalActiveStudents] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
        },
      }),
      prisma.student.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    for (const r of records) {
      if (r.status === 'PRESENT') presentCount++;
      else if (r.status === 'LATE') lateCount++;
      else if (r.status === 'ABSENT') absentCount++;
    }

    const totalMarked = records.length;
    const presentPercentage =
      totalActiveStudents > 0
        ? parseFloat((((presentCount + lateCount) / totalActiveStudents) * 100).toFixed(1))
        : 0;

    return {
      date: startOfDay.toISOString().split('T')[0],
      stats: {
        totalActiveStudents,
        totalMarked,
        presentCount,
        lateCount,
        absentCount,
        unmarkedCount: Math.max(0, totalActiveStudents - totalMarked),
        presentPercentage,
      },
      records,
    };
  }

  /**
   * Retrieves complete attendance history for a single student.
   */
  async getStudentAttendanceHistory(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      const error: AppError = new Error(`Student with ID '${studentId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const records = await prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
    });

    let present = 0;
    let late = 0;
    let absent = 0;

    for (const r of records) {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'ABSENT') absent++;
    }

    const totalDays = records.length;
    const percentage =
      totalDays > 0 ? parseFloat((((present + late) / totalDays) * 100).toFixed(1)) : 0;

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        rollNumber: student.rollNumber,
        currentClass: student.currentClass,
      },
      stats: {
        totalDays,
        present,
        late,
        absent,
        percentage,
      },
      history: records,
    };
  }
}

export const attendanceService = new AttendanceService();
