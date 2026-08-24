import { prisma } from '../../lib/prisma';
import { pdfService } from '../documents/pdf.service';
import {
  RegisterPartnerInput,
  UpdatePartnerStatusInput,
  PartnerQueryInput,
} from './partners.schema';
import { AppError } from '../../middleware/error.middleware';

export class PartnersService {
  /**
   * Generates sequential Partner Code in format PRT-YYYY-XXXX
   */
  async generatePartnerCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PRT-${year}-`;

    const total = await prisma.partnerInstitution.count();
    const sequence = (total + 1).toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Registers a new Partner Institution and generates a Partner Code.
   */
  async registerPartner(input: RegisterPartnerInput) {
    const partnerCode = await this.generatePartnerCode();

    const partner = await prisma.partnerInstitution.create({
      data: {
        ...input,
        partnerCode,
        status: 'PENDING',
        signedAt: input.signedAt || new Date(),
      },
    });

    return partner;
  }

  /**
   * Retrieves paginated list of registered partner institutions.
   */
  async getPartners(query: PartnerQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.institutionType) where.institutionType = query.institutionType;
    if (query.search) where.search = query.search;

    const [partners, total] = await Promise.all([
      prisma.partnerInstitution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.partnerInstitution.count({ where }),
    ]);

    return {
      partners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves partner institution by ID.
   */
  async getPartnerById(id: string) {
    const partner = await prisma.partnerInstitution.findUnique({
      where: { id },
    });

    if (!partner) {
      const error: AppError = new Error(`Partner institution with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return partner;
  }

  /**
   * Updates status of partner institution (Approval / Rejection).
   */
  async updatePartnerStatus(id: string, input: UpdatePartnerStatusInput) {
    await this.getPartnerById(id);

    const updated = await prisma.partnerInstitution.update({
      where: { id },
      data: input,
    });

    return updated;
  }

  /**
   * Generates filled PDF for partner institution registration form.
   */
  async generatePartnerRegistrationPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const partner = await this.getPartnerById(id);
    const html = pdfService.generatePartnerRegistrationHtml(partner);
    const buffer = await pdfService.generatePdfFromHtml(html);
    const filename = `AZM-Partner-Registration-${partner.partnerCode || partner.id}.pdf`;

    return { buffer, filename };
  }
}

export const partnersService = new PartnersService();
