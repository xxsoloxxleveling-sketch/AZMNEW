import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { hallDate } from '../exam-halls/examHalls.service';
import { AppError } from '../../middleware/error.middleware';
import { CreateTestCenterInput, UpdateTestCenterInput } from './testCenters.schema';

export class TestCentersService {
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
      } catch (error: any) {
        if (error.code !== 'P2034') throw error;
        if (attempt >= 2) {
          const conflict: AppError = new Error('A concurrent center modification conflicted with this operation. Please retry.');
          conflict.statusCode = 409;
          throw conflict;
        }
      }
    }
  }
  async getTestCenters() {
    const centers = await prisma.testCenter.findMany({
      include: {
        examHalls: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Compute live assigned candidate count for each center
    const studentCountPromises = centers.map(async (center) => {
      const assignedCount = await prisma.student.count({
        where: {
          assignedHallId: { in: center.examHalls.map(hall => hall.id) },
        },
      });
      return {
        ...center,
        assignedCount,
      };
    });

    return Promise.all(studentCountPromises);
  }

  async getTestCenterById(id: string) {
    const center = await prisma.testCenter.findUnique({
      where: { id },
      include: {
        examHalls: true,
      },
    });

    if (!center) {
      const error: AppError = new Error(`Test center with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const assignedCount = await prisma.student.count({
      where: {
        assignedHallId: { in: center.examHalls.map(hall => hall.id) },
      },
    });

    return {
      ...center,
      assignedCount,
    };
  }

  async createTestCenter(input: CreateTestCenterInput) {
    const existing = await prisma.testCenter.findUnique({
      where: { code: input.code },
    });

    if (existing) {
      const error: AppError = new Error(`Test center with code '${input.code}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    return prisma.testCenter.create({
      data: {
        name: input.name,
        code: input.code,
        campus: input.campus,
        address: input.address,
        district: input.district,
        province: input.province || 'Khyber Pakhtunkhwa',
        capacity: Number(input.capacity) || 300,
        reportingTime: input.reportingTime ?? '',
        testDate: input.testDate ?? '',
        contactPerson: input.contactPerson,
        contactPhone: input.contactPhone,
        status: input.status || 'ACTIVE',
      },
    });
  }

  async updateTestCenter(id: string, input: UpdateTestCenterInput) {
    return this.transaction(async tx => {
      const previous = await tx.testCenter.findUnique({ where: { id }, include: { examHalls: true } });
      if (!previous) {
        const error: AppError = new Error('Test center not found.');
        error.statusCode = 404;
        throw error;
      }
      const center = await tx.testCenter.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.campus !== undefined ? { campus: input.campus } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.district !== undefined ? { district: input.district } : {}),
          ...(input.province !== undefined ? { province: input.province } : {}),
          ...(input.capacity !== undefined ? { capacity: Number(input.capacity) } : {}),
          ...(input.reportingTime !== undefined ? { reportingTime: input.reportingTime } : {}),
          ...(input.testDate !== undefined ? { testDate: input.testDate } : {}),
          ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
          ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      if (input.name !== undefined || input.reportingTime !== undefined || input.testDate !== undefined) {
        for (const oldHall of previous.examHalls.sort((a, b) => a.id.localeCompare(b.id))) {
          // Copied center schedules follow updates only while still matching the old center.
          // Explicit Hall overrides are retained because no inheritance flag exists.
          const hall = await tx.examHall.update({ where: { id: oldHall.id }, data: {
            ...(input.reportingTime !== undefined && oldHall.reportingTime === previous.reportingTime ? { reportingTime: center.reportingTime } : {}),
            ...(input.testDate !== undefined && oldHall.examDate === previous.testDate ? { examDate: center.testDate } : {}),
          } });
          const students = await tx.student.findMany({ where: { assignedHallId: hall.id }, select: { id: true }, orderBy: { id: 'asc' } });
          const fields = { testCentre: center.name, testReportingTime: hall.reportingTime || null, testDate: hallDate(hall.examDate) };
          for (const student of students) await tx.officeUseRecord.upsert({ where: { studentId: student.id }, create: { studentId: student.id, ...fields }, update: fields });
        }
      }
      return center;
    });
  }

  async deleteTestCenter(id: string) {
    return this.transaction(async tx => {
      const center = await tx.testCenter.findUnique({ where: { id } });
      if (!center) {
        const error: AppError = new Error('Test center not found.');
        error.statusCode = 404;
        throw error;
      }
      if (await tx.examHall.count({ where: { testCenterId: id } })) {
        const error: AppError = new Error('This test center has halls. Move or delete those halls before deleting the center.');
        error.statusCode = 409;
        throw error;
      }
      return tx.testCenter.delete({ where: { id } });
    });
  }
}

export const testCentersService = new TestCentersService();
