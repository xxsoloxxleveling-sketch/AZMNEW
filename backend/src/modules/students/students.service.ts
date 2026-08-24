import { prisma } from '../../lib/prisma';
import { qrService } from '../attendance/qr.service';
import { pdfService } from '../documents/pdf.service';
import { supabaseStorage } from '../../lib/supabaseStorage';
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
  OfficeUseUpdateInput,
} from './students.schema';
import { AppError } from '../../middleware/error.middleware';

export class StudentsService {
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
      ...student,
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
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.classLevel) {
      where.currentClass = query.classLevel;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { fullName: { contains: s } },
        { rollNumber: { contains: s } },
        { cnicOrBForm: { contains: s } },
        { applicationNo: { contains: s } },
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
        },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      students,
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
      },
    });

    if (!student) {
      const error: AppError = new Error(`Student with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return student;
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
      },
    });

    return updated;
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
   * Generates filled 2-page registration PDF matching official form.
   */
  async generateRegistrationPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const student = await this.getStudentById(id);
    const html = pdfService.generateStudentRegistrationHtml(student);
    const buffer = await pdfService.generatePdfFromHtml(html);
    const filename = `AZM-Registration-${student.applicationNo || student.id}.pdf`;

    return { buffer, filename };
  }
}

export const studentsService = new StudentsService();
