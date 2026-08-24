import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma';
import { qrService } from '../attendance/qr.service';
import { pdfService } from '../documents/pdf.service';
import { supabaseStorage, StorageBucket } from '../../lib/supabaseStorage';
import { logger } from '../../lib/logger';
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
  OfficeUseUpdateInput,
} from './students.schema';
import { AppError } from '../../middleware/error.middleware';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch {}
}

export class StudentsService {
  /**
   * Formats a raw database student and attaches parsed live Supabase documents.
   */
  formatStudentWithDocuments(student: any) {
    if (!student) return null;
    let uploadedDocuments: Record<string, any> = {};

    if (student.uploadedDocsJson) {
      try {
        uploadedDocuments = JSON.parse(student.uploadedDocsJson);
      } catch {}
    }

    if (student.photoUrl && !uploadedDocuments.photo) {
      uploadedDocuments.photo = {
        name: `${student.fullName}_Passport_Photo.jpg`,
        size: 'Supabase Cloud Storage',
        dataUrl: student.photoUrl,
        publicUrl: student.photoUrl,
        uploadedAt: student.createdAt,
      };
    }

    return {
      ...student,
      uploadedDocuments: Object.keys(uploadedDocuments).length > 0 ? uploadedDocuments : undefined,
    };
  }

  /**
   * Generates sequential Roll Number in format AZMVS-YYYY-XXXX (collision-proof)
   */
  async generateRollNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AZMVS-${year}-`;

    const existing = await prisma.student.findMany({
      where: {
        rollNumber: {
          startsWith: prefix,
        },
      },
      select: { rollNumber: true },
    });

    let maxNum = 0;
    for (const s of existing) {
      if (s.rollNumber) {
        const parts = s.rollNumber.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let nextSeq = maxNum + 1;
    let rollNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    while (await prisma.student.findUnique({ where: { rollNumber } })) {
      nextSeq++;
      rollNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    }

    return rollNumber;
  }

  /**
   * Generates sequential Application Number in format APP-YYYY-XXXX (collision-proof)
   */
  async generateApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;

    const existing = await prisma.student.findMany({
      where: {
        applicationNo: {
          startsWith: prefix,
        },
      },
      select: { applicationNo: true },
    });

    let maxNum = 0;
    for (const s of existing) {
      if (s.applicationNo) {
        const parts = s.applicationNo.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let nextSeq = maxNum + 1;
    let applicationNo = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    while (await prisma.student.findUnique({ where: { applicationNo } })) {
      nextSeq++;
      applicationNo = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    }

    return applicationNo;
  }

  /**
   * Generates sequential Challan Number in format CHL-YYYY-XXXX (collision-proof)
   */
  async generateChallanNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CHL-${year}-`;

    const existing = await prisma.feeRecord.findMany({
      where: {
        challanNumber: {
          startsWith: prefix,
        },
      },
      select: { challanNumber: true },
    });

    let maxNum = 0;
    for (const f of existing) {
      if (f.challanNumber) {
        const parts = f.challanNumber.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let nextSeq = maxNum + 1;
    let challanNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    while (await prisma.feeRecord.findUnique({ where: { challanNumber } })) {
      nextSeq++;
      challanNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    }

    return challanNumber;
  }

  /**
   * Alias for getRegistrationPdf
   */
  async generateRegistrationPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    return this.getRegistrationPdf(id);
  }

  /**
   * Creates a student record with all registration form fields (Parts A-I),
   * auto-generates Application Number and a fixed PKR 300 Registration Fee Challan.
   * Roll Number and Biometric QR Code will be issued upon Admin/Accountant fee approval.
   */
  async createStudent(input: CreateStudentInput) {
    const existing = await prisma.student.findUnique({
      where: { cnicOrBForm: input.cnicOrBForm },
    });

    if (existing) {
      const error: AppError = new Error(
        `A student with CNIC / B-Form '${input.cnicOrBForm}' is already registered.`
      );
      error.statusCode = 409;
      throw error;
    }

    const { academicRecords, documents, photoUrl: inputPhotoUrl, ...baseData } = input;

    let student: any = null;
    let lastError: any = null;

    // Retry loop to ensure zero unique constraint collision on applicationNo
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const applicationNo = await this.generateApplicationNumber();
        const qrToken = `PENDING-FEE-${applicationNo}`;

        // Persist Photo if provided
        let photoUrl = inputPhotoUrl;
        if (inputPhotoUrl && inputPhotoUrl.startsWith('data:')) {
          const uploadRes = await supabaseStorage.uploadFile(
            'student-photos',
            `${applicationNo}-photo.png`,
            inputPhotoUrl,
            'image/png'
          );
          if (!uploadRes.error) {
            const signed = await supabaseStorage.getSignedUrl('student-photos', `${applicationNo}-photo.png`, 86400 * 7);
            if (signed) photoUrl = signed;
          }
        }

        student = await prisma.student.create({
          data: {
            ...baseData,
            photoUrl,
            uploadedDocsJson: input.uploadedDocuments ? JSON.stringify(input.uploadedDocuments) : null,
            applicationNo,
            rollNumber: null, // Defer roll number until fee is approved
            qrToken,
            qrImageUrl: null,
            ...(academicRecords && academicRecords.length > 0
              ? {
                  academicRecords: {
                    create: academicRecords,
                  },
                }
              : {}),
            ...(documents
              ? {
                  documents: {
                    create: documents,
                  },
                }
              : {}),
            officeUse: {
              create: {
                eligibility: 'ELIGIBLE',
                finalStatus: 'SHORTLISTED',
                testRollNo: null,
                testCentre: 'Main Campus Examination Center, Mansehra',
                testReportingTime: '09:00 AM',
              },
            },
          },
          include: {
            academicRecords: true,
            documents: true,
            officeUse: true,
          },
        });
        break;
      } catch (err: any) {
        lastError = err;
        // If unique constraint on applicationNo, retry with next number
        if (
          err.code === 'P2002' ||
          (err.message && err.message.includes('Unique constraint') && err.message.includes('applicationNo'))
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!student) {
      throw lastError || new Error('Failed to create student due to unique sequence conflict.');
    }

    // Auto-generate Fixed PKR 300 Registration Fee Challan
    const challanNumber = await this.generateChallanNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);

    const feeRecord = await prisma.feeRecord.create({
      data: {
        studentId: student.id,
        month: 'Session V (2026) Registration',
        amountDue: 300,
        amountPaid: 0,
        status: 'UNPAID',
        challanNumber,
        dueDate,
      },
    });

    return {
      ...this.formatStudentWithDocuments(student),
      feeChallan: feeRecord,
    };
  }

  /**
   * Approves student payment, assigns sequential Roll Number, and generates biometric QR Code.
   */
  async approveStudentPayment(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { feeRecords: true },
    });

    if (!student) {
      const error: AppError = new Error(`Student with ID '${studentId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    let rollNumber = student.rollNumber;
    let qrToken = student.qrToken;
    let qrImageUrl = student.qrImageUrl;

    // If roll number not assigned yet, generate it now
    if (!rollNumber) {
      rollNumber = await this.generateRollNumber();
      qrToken = qrService.generateSignedQrToken(rollNumber);
      const qrPayload = `https://jadoon.edu.pk/attend?token=${qrToken}`;
      qrImageUrl = await qrService.generateQrDataUrl(qrPayload);

      await supabaseStorage.uploadFile('qr-codes', `${rollNumber}-qr.png`, qrImageUrl, 'image/png');
    }

    // Mark student's registration fee records as PAID
    await prisma.feeRecord.updateMany({
      where: { studentId: student.id },
      data: {
        status: 'PAID',
        amountPaid: 300,
        paidAt: new Date(),
      },
    });

    // Update Student with assigned Roll Number & active QR code
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
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
      include: {
        feeRecords: true,
        officeUse: true,
      },
    });

    return updatedStudent;
  }

  /**
   * Retrieves paginated list of students with search & filter options.
   */
  async getStudents(query: StudentQueryInput) {
    const page = parseInt(String(query.page || 1), 10) || 1;
    const limit = parseInt(String(query.limit || 500), 10) || 500;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status && (query.status as any) !== 'ALL') {
      where.status = query.status;
    }

    if (query.classLevel && query.classLevel !== 'ALL') {
      where.currentClass = { contains: query.classLevel, mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { rollNumber: { contains: s, mode: 'insensitive' } },
        { cnicOrBForm: { contains: s, mode: 'insensitive' } },
        { applicationNo: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          academicRecords: true,
          documents: true,
          officeUse: true,
          feeRecords: true,
        },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      students: students.map((s) => this.formatStudentWithDocuments(s)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a student by unique ID including all relations.
   */
  async getStudentById(id: string) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        academicRecords: true,
        documents: true,
        officeUse: true,
        feeRecords: true,
      },
    });

    if (!student) {
      const error: AppError = new Error(`Student with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return this.formatStudentWithDocuments(student);
  }

  /**
   * Updates student information.
   */
  async updateStudent(id: string, input: UpdateStudentInput) {
    await this.getStudentById(id);

    const { academicRecords, documents, ...baseData } = input;

    const updated = await prisma.student.update({
      where: { id },
      data: baseData,
      include: {
        academicRecords: true,
        documents: true,
        officeUse: true,
        feeRecords: true,
      },
    });

    return this.formatStudentWithDocuments(updated);
  }

  /**
   * Admin updates Part L: Office Use Record.
   */
  async updateOfficeUse(studentId: string, input: OfficeUseUpdateInput) {
    await this.getStudentById(studentId);

    const officeRecord = await prisma.officeUseRecord.upsert({
      where: { studentId },
      update: {
        ...input,
        documentVerifiedAt: input.documentVerifiedAt || new Date(),
      },
      create: {
        studentId,
        ...input,
        documentVerifiedAt: input.documentVerifiedAt || new Date(),
      },
    });

    return officeRecord;
  }

  /**
   * Deletes a student record.
   */
  async deleteStudent(id: string) {
    await this.getStudentById(id);

    return prisma.student.delete({
      where: { id },
    });
  }

  /**
   * Retrieves QR metadata and binary buffer for a student.
   */
  async getStudentQr(id: string) {
    const student = await this.getStudentById(id);
    const qrPayload = `https://jadoon.edu.pk/attend?token=${student.qrToken}`;
    const qrBuffer = await qrService.generateQrBuffer(qrPayload);

    return {
      student,
      qrToken: student.qrToken,
      qrImageUrl: student.qrImageUrl,
      qrBuffer,
    };
  }

  /**
   * Generates Registration PDF buffer for downloading.
   */
  async getRegistrationPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const student = await this.getStudentById(id);
    const html = pdfService.generateStudentRegistrationHtml(student);
    const buffer = await pdfService.generatePdfFromHtml(html);
    const filename = `AZM-Registration-${student.applicationNo || student.id}.pdf`;

    return { buffer, filename };
  }

  /**
   * Uploads an attached candidate document directly to Supabase Cloud Storage + server disk backup.
   */
  async uploadStudentDocument(input: {
    studentId?: string;
    applicationNo?: string;
    cnicOrBForm?: string;
    docType: 'photo' | 'bform' | 'fatherCnic' | 'dmc' | 'domicile' | 'paymentReceipt' | string;
    fileName?: string;
    fileData: string;
    contentType?: string;
  }) {
    const rawApp = (input.applicationNo || input.cnicOrBForm || input.studentId || 'DOC').replace(/[^\w-]/g, '_');
    const ext = input.fileName?.split('.').pop() || (input.fileData.includes('application/pdf') ? 'pdf' : 'jpg');
    const bucket: StorageBucket = input.docType === 'photo' ? 'student-photos' : 'student-documents';
    const pathName = `${rawApp}/${input.docType}_${Date.now()}.${ext}`;

    // 1. Save locally to server uploads directory
    try {
      const candDir = path.join(UPLOADS_DIR, rawApp);
      if (!fs.existsSync(candDir)) {
        fs.mkdirSync(candDir, { recursive: true });
      }
      let buffer: Buffer;
      if (input.fileData.startsWith('data:')) {
        const b64 = input.fileData.split(',')[1];
        buffer = Buffer.from(b64, 'base64');
      } else {
        buffer = Buffer.from(input.fileData, 'utf-8');
      }
      fs.writeFileSync(path.join(candDir, `${input.docType}.${ext}`), buffer);
    } catch (diskErr) {
      logger.warn('Disk storage save warning:', diskErr);
    }

    // 2. Upload to Supabase Storage if available
    await supabaseStorage.ensureBucketExists(bucket);
    await supabaseStorage.uploadFile(
      bucket,
      pathName,
      input.fileData,
      input.contentType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg')
    );

    const publicUrl =
      supabaseStorage.getPublicUrl(bucket, pathName) ||
      (await supabaseStorage.getSignedUrl(bucket, pathName, 60 * 60 * 24 * 365)) ||
      `https://amteshciynijqkxapjwd.supabase.co/storage/v1/object/public/${bucket}/${pathName}`;

    // 3. Find student in PostgreSQL
    const student = await prisma.student.findFirst({
      where: input.studentId
        ? { id: input.studentId }
        : input.applicationNo
        ? { applicationNo: input.applicationNo }
        : { cnicOrBForm: input.cnicOrBForm },
    });

    let currentDocs: Record<string, any> = {};
    if (student?.uploadedDocsJson) {
      try {
        currentDocs = JSON.parse(student.uploadedDocsJson);
      } catch {}
    }

    currentDocs[input.docType] = {
      name: input.fileName || `${input.docType}.${ext}`,
      size: 'Cloud Storage Attached',
      dataUrl: input.fileData.startsWith('data:') ? input.fileData : publicUrl,
      publicUrl,
      supabasePath: pathName,
      uploadedAt: new Date().toISOString(),
    };

    if (student) {
      try {
        await prisma.student.update({
          where: { id: student.id },
          data: {
            uploadedDocsJson: JSON.stringify(currentDocs),
            ...(input.docType === 'photo' ? { photoUrl: input.fileData.startsWith('data:') ? input.fileData : publicUrl } : {}),
          },
        });
      } catch (err) {
        logger.warn('Failed to update student document in PostgreSQL:', err);
      }
    }

    return {
      success: true,
      bucket,
      path: pathName,
      publicUrl,
      docType: input.docType,
      fileName: input.fileName || `${input.docType}.${ext}`,
    };
  }

  /**
   * Retrieves a student's document or photo as a direct binary buffer for image streaming.
   */
  async getStudentDocument(studentIdentifier: string, docType: string): Promise<{ buffer: Buffer; contentType: string }> {
    const rawApp = studentIdentifier.replace(/[^\w-]/g, '_');

    // 1. Check server disk storage first
    const candDir = path.join(UPLOADS_DIR, rawApp);
    const possibleExts = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
    for (const ext of possibleExts) {
      const p = path.join(candDir, `${docType}.${ext}`);
      if (fs.existsSync(p)) {
        const buffer = fs.readFileSync(p);
        const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
        return { buffer, contentType: mime };
      }
    }

    // 2. Check PostgreSQL database records
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: studentIdentifier },
          { applicationNo: studentIdentifier },
          { cnicOrBForm: studentIdentifier },
        ],
      },
    });

    if (student) {
      if (docType === 'photo' && student.photoUrl && student.photoUrl.startsWith('data:')) {
        const parts = student.photoUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        return { buffer: Buffer.from(parts[1], 'base64'), contentType: mime };
      }

      if (student.uploadedDocsJson) {
        try {
          const docs = JSON.parse(student.uploadedDocsJson);
          const doc = docs[docType] || docs[`${docType}Uploaded`];
          if (doc && doc.dataUrl && doc.dataUrl.startsWith('data:')) {
            const parts = doc.dataUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)?.[1] || doc.fileType || 'image/jpeg';
            return { buffer: Buffer.from(parts[1], 'base64'), contentType: mime };
          }
        } catch (e) {}
      }
    }

    // 3. Fallback placeholder SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f8fafc"/>
      <circle cx="200" cy="160" r="70" fill="#cbd5e1"/>
      <path d="M60 360 C60 260, 340 260, 340 360 Z" fill="#94a3b8"/>
      <text x="200" y="385" font-family="sans-serif" font-size="16" font-weight="bold" fill="#64748b" text-anchor="middle">Official Document Record</text>
    </svg>`;
    return { buffer: Buffer.from(svg, 'utf-8'), contentType: 'image/svg+xml' };
  }

  /**
   * Complete Database & Storage Purge (Leaves admin user intact so login works)
   */
  async purgeAllData() {
    // 1. Delete all student dependent records and students
    await prisma.academicRecord.deleteMany();
    await prisma.documentChecklist.deleteMany();
    await prisma.officeUseRecord.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.feeRecord.deleteMany();
    await prisma.student.deleteMany();

    // 2. Delete partner schools
    await prisma.partnerInstitution.deleteMany();

    // 3. Delete payroll and staff
    await prisma.payrollRecord.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.staff.deleteMany();

    // 4. Empty Supabase Storage buckets
    await Promise.all([
      supabaseStorage.emptyBucket('student-photos'),
      supabaseStorage.emptyBucket('qr-codes'),
      supabaseStorage.emptyBucket('registration-pdfs'),
    ]);

    return {
      success: true,
      message: 'All student records, fee logs, attendance entries, partner schools, staff records, and storage attachments have been purged successfully.',
      timestamp: new Date().toISOString(),
    };
  }
}

export const studentsService = new StudentsService();
