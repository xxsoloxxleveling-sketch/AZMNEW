import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import {
  CreateExamHallInput,
  UpdateExamHallInput,
  BatchAssignInput,
  UpdateAllocationInput,
} from './examHalls.schema';

export class ExamHallsService {
  async getExamHalls() {
    const halls = await prisma.examHall.findMany({
      include: {
        testCenter: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const hallCountPromises = halls.map(async (hall) => {
      const assignedCount = await prisma.student.count({
        where: {
          OR: [
            { assignedHallId: hall.id },
            { assignedHall: { contains: hall.name, mode: 'insensitive' } },
          ],
        },
      });

      return {
        ...hall,
        assignedCount,
        centerName: hall.testCenter?.name || 'Main Campus Examination Center, Mansehra',
      };
    });

    return Promise.all(hallCountPromises);
  }

  async getExamHallById(id: string) {
    const hall = await prisma.examHall.findUnique({
      where: { id },
      include: {
        testCenter: true,
      },
    });

    if (!hall) {
      const error: AppError = new Error(`Exam hall with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const assignedStudents = await prisma.student.findMany({
      where: {
        OR: [
          { assignedHallId: hall.id },
          { assignedHall: { contains: hall.name, mode: 'insensitive' } },
        ],
      },
      orderBy: { seatNo: 'asc' },
    });

    return {
      ...hall,
      centerName: hall.testCenter?.name || 'Main Campus Examination Center, Mansehra',
      assignedStudents,
      assignedCount: assignedStudents.length,
    };
  }

  async createExamHall(input: CreateExamHallInput) {
    return prisma.examHall.create({
      data: {
        name: input.name,
        roomNumber: input.roomNumber,
        targetClass: input.targetClass,
        wing: input.wing,
        capacity: Number(input.capacity) || 60,
        invigilatorName: input.invigilatorName,
        invigilatorPhone: input.invigilatorPhone,
        reportingTime: input.reportingTime || '09:00 AM',
        examDate: input.examDate || 'Sunday, 15 November 2026',
        testCenterId: input.testCenterId,
      },
      include: {
        testCenter: true,
      },
    });
  }

  async updateExamHall(id: string, input: UpdateExamHallInput) {
    await this.getExamHallById(id);

    return prisma.examHall.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.roomNumber !== undefined ? { roomNumber: input.roomNumber } : {}),
        ...(input.targetClass !== undefined ? { targetClass: input.targetClass } : {}),
        ...(input.wing !== undefined ? { wing: input.wing } : {}),
        ...(input.capacity !== undefined ? { capacity: Number(input.capacity) } : {}),
        ...(input.invigilatorName !== undefined ? { invigilatorName: input.invigilatorName } : {}),
        ...(input.invigilatorPhone !== undefined ? { invigilatorPhone: input.invigilatorPhone } : {}),
        ...(input.reportingTime !== undefined ? { reportingTime: input.reportingTime } : {}),
        ...(input.examDate !== undefined ? { examDate: input.examDate } : {}),
        ...(input.testCenterId !== undefined ? { testCenterId: input.testCenterId } : {}),
      },
      include: {
        testCenter: true,
      },
    });
  }

  async deleteExamHall(id: string) {
    await this.getExamHallById(id);

    // Detach any assigned students from this hall
    await prisma.student.updateMany({
      where: { assignedHallId: id },
      data: {
        assignedHallId: null,
        assignedHall: null,
        assignedRoom: null,
        seatNo: null,
      },
    });

    return prisma.examHall.delete({
      where: { id },
    });
  }

  async batchAssign(hallId: string, input: BatchAssignInput) {
    const hall = await this.getExamHallById(hallId);
    const hallName = input.hallName || hall.name;
    const roomNumber = input.roomNumber || hall.roomNumber;
    const centerName = input.testCenterName || hall.centerName;

    // Get current count of seated students in this hall to sequence seat numbers
    const currentSeatedCount = await prisma.student.count({
      where: { assignedHallId: hallId },
    });

    const updates = input.studentIds.map((studentId, idx) => {
      const seatNumber = `Seat #${(currentSeatedCount + idx + 1).toString().padStart(2, '0')}`;
      return prisma.student.update({
        where: { id: studentId },
        data: {
          assignedHallId: hallId,
          assignedHall: hallName,
          assignedRoom: roomNumber,
          seatNo: seatNumber,
          officeUse: {
            upsert: {
              create: {
                testCentre: centerName,
                testReportingTime: hall.reportingTime,
                testDate: hall.examDate,
              },
              update: {
                testCentre: centerName,
                testReportingTime: hall.reportingTime,
                testDate: hall.examDate,
              },
            },
          },
        },
      });
    });

    await prisma.$transaction(updates);

    return {
      success: true,
      assignedCount: input.studentIds.length,
      hallName,
      roomNumber,
    };
  }

  async updateStudentAllocation(studentId: string, input: UpdateAllocationInput) {
    return prisma.student.update({
      where: { id: studentId },
      data: {
        ...(input.assignedHallId !== undefined ? { assignedHallId: input.assignedHallId } : {}),
        ...(input.assignedHall !== undefined ? { assignedHall: input.assignedHall } : {}),
        ...(input.assignedRoom !== undefined ? { assignedRoom: input.assignedRoom } : {}),
        ...(input.seatNo !== undefined ? { seatNo: input.seatNo } : {}),
        ...(input.testCenterName
          ? {
              officeUse: {
                upsert: {
                  create: { testCentre: input.testCenterName },
                  update: { testCentre: input.testCenterName },
                },
              },
            }
          : {}),
      },
    });
  }

  async unassignStudent(studentId: string) {
    return prisma.student.update({
      where: { id: studentId },
      data: {
        assignedHallId: null,
        assignedHall: null,
        assignedRoom: null,
        seatNo: null,
      },
    });
  }
}

export const examHallsService = new ExamHallsService();
