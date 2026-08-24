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
   * Generates sequential Roll Number in format JPS-YYYY-XXXX
   */
  async generateRollNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JPS-${year}-`;

    const totalInYear = await prisma.student.count({
      where: {
        rollNumber: {
          startsWith: prefix,
        },
      },
    });

    const sequence = (totalInYear + 1).toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generates sequential Application Number in format APP-YYYY-XXXX
   */
  async generateApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;

    const totalInYear = await prisma.student.count({
      where: {
        applicationNo: {
          startsWith: prefix,
        },
      },
    });

    const sequence = (totalInYear + 1).toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Creates a student record with all registration form fields (Parts A-I),
   * auto-generates Roll Number, Application Number, signed QR Token, and QR Image.
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

    const applicationNo = await this.generateApplicationNumber();
    const qrToken = `PENDING-FEE-${applicationNo}`;

    // Persist Photo if provided
    let photoUrl = input.photoUrl;
    if (input.photoUrl && input.photoUrl.startsWith('data:')) {
      const uploadRes = await supabaseStorage.uploadFile(
        'student-photos',
        `${applicationNo}-photo.png`,
        input.photoUrl,
        'image/png'
      );
      if (!uploadRes.error) {
        const signed = await supabaseStorage.getSignedUrl('student-photos', `${applicationNo}-photo.png`, 86400 * 7);
        if (signed) photoUrl = signed;
      }
    }

    const { academicRecords, documents, photoUrl: _, ...baseData } = input;

    const student = await prisma.student.create({
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
            testCentre: 'Jadoon Public School & College Exam Centre',
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

    // Auto-generate Fixed PKR 300 Registration Fee Challan
    const year = new Date().getFullYear();
    const totalChallans = await prisma.feeRecord.count();
    const challanNumber = `CHL-${year}-${(totalChallans + 1).toString().padStart(4, '0')}`;
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
