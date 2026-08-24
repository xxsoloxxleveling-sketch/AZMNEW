import { prisma, GrievanceStatus } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { CreateGrievanceInput, UpdateGrievanceInput } from './grievances.schema';

export class GrievancesService {
  async createGrievance(input: CreateGrievanceInput) {
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(100 + Math.random() * 900);
    const ticketId = `TKT-2026-${timestamp}${random}`;

    return prisma.grievanceTicket.create({
      data: {
        ticketId,
        name: input.name,
        email: input.email || null,
        phone: input.phone,
        category: input.category,
        cnicOrRollNo: input.cnicOrRollNo || null,
        subject: input.subject || `Inquiry regarding ${input.category}`,
        message: input.message,
        status: GrievanceStatus.OPEN,
      },
    });
  }

  async getGrievances(filters?: { status?: string; category?: string; search?: string }) {
    const where: any = {};

    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status as GrievanceStatus;
    }
    if (filters?.category && filters.category !== 'all') {
      where.category = { contains: filters.category, mode: 'insensitive' };
    }
    if (filters?.search) {
      where.OR = [
        { ticketId: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { cnicOrRollNo: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.grievanceTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGrievanceById(idOrTicket: string) {
    const grievance = await prisma.grievanceTicket.findFirst({
      where: {
        OR: [{ id: idOrTicket }, { ticketId: idOrTicket }],
      },
    });

    if (!grievance) {
      const error: AppError = new Error(`Grievance ticket '${idOrTicket}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return grievance;
  }

  async updateGrievance(id: string, input: UpdateGrievanceInput) {
    await this.getGrievanceById(id);

    return prisma.grievanceTicket.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.response !== undefined ? { response: input.response } : {}),
      },
    });
  }
}

export const grievancesService = new GrievancesService();
