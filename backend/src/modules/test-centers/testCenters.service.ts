import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { CreateTestCenterInput, UpdateTestCenterInput } from './testCenters.schema';

export class TestCentersService {
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
          OR: [
            { officeUse: { testCentre: { contains: center.name, mode: 'insensitive' } } },
            { officeUse: { testCentre: { contains: center.code, mode: 'insensitive' } } },
          ],
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
        OR: [
          { officeUse: { testCentre: { contains: center.name, mode: 'insensitive' } } },
          { officeUse: { testCentre: { contains: center.code, mode: 'insensitive' } } },
        ],
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
        reportingTime: input.reportingTime || '09:00 AM',
        testDate: input.testDate || 'Sunday, 15 November 2026',
        contactPerson: input.contactPerson,
        contactPhone: input.contactPhone,
        status: input.status || 'ACTIVE',
      },
    });
  }

  async updateTestCenter(id: string, input: UpdateTestCenterInput) {
    await this.getTestCenterById(id);

    return prisma.testCenter.update({
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
  }

  async deleteTestCenter(id: string) {
    await this.getTestCenterById(id);

    return prisma.testCenter.delete({
      where: { id },
    });
  }
}

export const testCentersService = new TestCentersService();
