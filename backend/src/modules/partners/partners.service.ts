import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { pdfService } from '../documents/pdf.service';
import {
  RegisterPartnerInput,
  UpdatePartnerStatusInput,
  PartnerQueryInput,
} from './partners.schema';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../lib/logger';

export class PartnersService {
  /**
   * Generates sequential Partner Code in format PRT-YYYY-XXXX atomically.
   * Derives year dynamically and utilizes database row locking / atomic increment
   * to guarantee uniqueness and prevent race conditions under concurrent submissions.
   */
  async generatePartnerCode(tx?: any): Promise<string> {
    const year = new Date().getFullYear();
    const db = tx || prisma;

    const seq = await db.partnerCodeSequence.upsert({
      where: { year },
      update: {
        lastNumber: {
          increment: 1,
        },
      },
      create: {
        year,
        lastNumber: 1,
      },
    });

    const sequencePadded = seq.lastNumber.toString().padStart(4, '0');
    return `PRT-${year}-${sequencePadded}`;
  }

  /**
   * Public registration with persistent idempotency and institutional duplicate protection.
   */
  async registerPartner(input: RegisterPartnerInput, idempotencyKey?: string) {
    const payloadJson = JSON.stringify(input);
    const payloadHash = crypto.createHash('sha256').update(payloadJson).digest('hex');

    // 1. Check Idempotency Key if supplied by client
    if (idempotencyKey) {
      const existingIdempotency = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });

      if (existingIdempotency) {
        if (existingIdempotency.expiresAt > new Date()) {
          if (existingIdempotency.payloadHash === payloadHash) {
            logger.info(`[Idempotency] Returning cached partner registration for key: ${idempotencyKey}`);
            return JSON.parse(existingIdempotency.response);
          } else {
            const conflictErr: AppError = new Error(
              'Idempotency key was previously used with a different request payload.'
            );
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
        }
      }
    }

    // 2. Institutional Duplicate Detection
    // Match based on normalized institutionName + district + campus to prevent double registration
    const normName = input.institutionName.trim();
    const normDistrict = input.district.trim();
    const normCampus = input.campus ? input.campus.trim() : null;

    const existingPartner = await prisma.partnerInstitution.findFirst({
      where: {
        institutionName: { equals: normName, mode: 'insensitive' },
        district: { equals: normDistrict, mode: 'insensitive' },
        campus: normCampus ? { equals: normCampus, mode: 'insensitive' } : null,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (existingPartner) {
      const dupError: AppError = new Error(
        `An institutional partnership registration for "${input.institutionName}" (${input.district}${
          normCampus ? ` - ${normCampus}` : ''
        }) already exists under Partner Code ${existingPartner.partnerCode}. Please contact Central Secretariat (0305-1755551) for verification.`
      );
      dupError.statusCode = 409;
      throw dupError;
    }

    // 3. Normalize values
    const normalizedEmail = input.contactEmail ? input.contactEmail.trim().toLowerCase() : null;
    const normalizedMobile = input.contactMobile.replace(/\s+/g, '').trim();
    const normalizedWhatsapp = input.contactWhatsapp ? input.contactWhatsapp.replace(/\s+/g, '').trim() : normalizedMobile;

    // 4. Transactional code allocation & record insertion
    const createdPartner = await prisma.$transaction(async (tx) => {
      const partnerCode = await this.generatePartnerCode(tx);

      const partner = await tx.partnerInstitution.create({
        data: {
          institutionName: input.institutionName.trim(),
          institutionType: input.institutionType,
          campus: input.campus ? input.campus.trim() : null,
          address: input.address.trim(),
          district: input.district.trim(),
          province: input.province.trim(),
          contactName: input.contactName.trim(),
          contactDesignation: input.contactDesignation.trim(),
          contactMobile: normalizedMobile,
          contactWhatsapp: normalizedWhatsapp,
          contactEmail: normalizedEmail,
          website: input.website ? input.website.trim() : null,
          classesOffered: input.classesOffered,
          studentStrength: input.studentStrength || null,
          expectedApplicants: input.expectedApplicants || null,
          agreedToTerms: input.agreedToTerms,
          signedAt: input.signedAt || new Date(),
          partnerCode,
          status: 'PENDING',
        },
      });

      // Store initial audit record
      await tx.partnerStatusAudit.create({
        data: {
          partnerId: partner.id,
          previousStatus: 'PENDING',
          newStatus: 'PENDING',
          reason: 'Initial Public Registration Submission',
          changedByName: 'Public Portal',
        },
      });

      // Record Idempotency key if provided (valid for 24h)
      if (idempotencyKey) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await tx.idempotencyRecord.upsert({
          where: { key: idempotencyKey },
          update: {
            payloadHash,
            statusCode: 201,
            response: JSON.stringify(partner),
            expiresAt,
          },
          create: {
            key: idempotencyKey,
            action: 'PARTNER_REGISTER',
            payloadHash,
            statusCode: 201,
            response: JSON.stringify(partner),
            expiresAt,
          },
        });
      }

      return partner;
    });

    return createdPartner;
  }

  /**
   * Retrieves paginated, sorted, and filtered list of registered partner institutions.
   */
  async getPartners(query: PartnerQueryInput) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 25), 10) || 25));
    const skip = (page - 1) * limit;

    // Allowlisted sorting columns
    const allowedSortFields: Record<string, string> = {
      createdAt: 'createdAt',
      institutionName: 'institutionName',
      partnerCode: 'partnerCode',
      status: 'status',
      district: 'district',
      expectedApplicants: 'expectedApplicants',
      studentStrength: 'studentStrength',
    };

    const sortBy = allowedSortFields[String(query.sortBy || 'createdAt')] || 'createdAt';
    const sortOrder = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Construct robust search and filter conditions
    const andConditions: any[] = [];

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.institutionType) {
      andConditions.push({ institutionType: query.institutionType });
    }

    if (query.district && query.district !== 'ALL' && query.district !== 'all') {
      andConditions.push({
        district: { equals: query.district.trim(), mode: 'insensitive' },
      });
    }

    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      andConditions.push({
        OR: [
          { institutionName: { contains: searchTerm, mode: 'insensitive' } },
          { contactName: { contains: searchTerm, mode: 'insensitive' } },
          { partnerCode: { contains: searchTerm, mode: 'insensitive' } },
          { campus: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
          { contactMobile: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [partners, total] = await Promise.all([
      prisma.partnerInstitution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.partnerInstitution.count({ where }),
    ]);

    return {
      data: partners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves partner institution by ID with full audit history.
   */
  async getPartnerById(id: string) {
    const partner = await prisma.partnerInstitution.findUnique({
      where: { id },
      include: {
        statusAudits: {
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!partner) {
      const error: AppError = new Error(`Partner institution with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return partner;
  }

  /**
   * Retrieves immutable audit trail for a partner institution.
   */
  async getStatusHistory(partnerId: string) {
    await this.getPartnerById(partnerId);

    const history = await prisma.partnerStatusAudit.findMany({
      where: { partnerId },
      orderBy: { changedAt: 'desc' },
    });

    return history;
  }

  /**
   * Updates partner institution status with state machine enforcement and audit record creation.
   * Features optimistic concurrency protection to prevent stale overwrites.
   */
  async updatePartnerStatus(
    id: string,
    input: UpdatePartnerStatusInput,
    user?: { id?: string; email?: string; name?: string }
  ) {
    const partner = await this.getPartnerById(id);
    const previousStatus = partner.status;
    const newStatus = input.status;

    // 1. Check for redundant no-op transition
    if (previousStatus === newStatus) {
      const err: AppError = new Error(`Partner institution is already in '${newStatus}' status.`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Optimistic Concurrency Check: If client specified expectedStatus
    if (input.expectedStatus && partner.status !== input.expectedStatus) {
      const conflictErr: AppError = new Error(
        `Status conflict: This institution's status was recently updated to '${partner.status}' by another administrator. Please refresh the record.`
      );
      conflictErr.statusCode = 409;
      throw conflictErr;
    }

    // 3. Enforce Business Rules on State Transitions
    // PENDING -> REJECTED, APPROVED -> REJECTED, REJECTED -> APPROVED require mandatory reason
    if (newStatus === 'REJECTED' && (!input.reason || !input.reason.trim())) {
      const reasonErr: AppError = new Error('A valid reason is required when rejecting a partner application.');
      reasonErr.statusCode = 400;
      throw reasonErr;
    }

    if (previousStatus === 'REJECTED' && newStatus === 'APPROVED' && (!input.reason || !input.reason.trim())) {
      const reasonErr: AppError = new Error('A justification reason is required when reversing a rejected partner to approved.');
      reasonErr.statusCode = 400;
      throw reasonErr;
    }

    const reviewerName = user?.name || user?.email || 'Admin';

    // 4. Atomic Transaction: Update Partner Institution + Insert Status Audit
    const updated = await prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.partnerInstitution.update({
        where: { id },
        data: {
          status: newStatus,
          rejectionReason: newStatus === 'APPROVED' ? null : input.reason || partner.rejectionReason,
          reviewedBy: reviewerName,
          reviewedAt: new Date(),
        },
      });

      await tx.partnerStatusAudit.create({
        data: {
          partnerId: id,
          previousStatus,
          newStatus,
          reason: input.reason ? input.reason.trim() : null,
          changedById: user?.id || null,
          changedByEmail: user?.email || null,
          changedByName: reviewerName,
          changedAt: new Date(),
        },
      });

      return updatedRecord;
    });

    logger.info(`[Partner Status] Partner ${partner.partnerCode} status updated: ${previousStatus} -> ${newStatus} by ${reviewerName}`);
    return updated;
  }

  /**
   * Generates filled PDF for partner institution registration form / MOU.
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

