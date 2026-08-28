import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { prisma, TransactionType } from '../../lib/prisma';
import { qrService } from '../attendance/qr.service';
import { pdfService } from '../documents/pdf.service';
import { supabaseStorage, StorageBucket } from '../../lib/supabaseStorage';
import { logger } from '../../lib/logger';
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
  OfficeUseUpdateInput,
  UploadDocumentInput,
  ALLOWED_FILE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
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
      const ageInMs = Date.now() - new Date(existing.createdAt).getTime();
      const isRecentSubmission = ageInMs < 15 * 60 * 1000; // within last 15 minutes
      const isSameName =
        (existing.fullName || '').trim().toLowerCase() === (input.fullName || '').trim().toLowerCase();

      if (isRecentSubmission && isSameName) {
        logger.info(
          `Idempotent retry returning existing candidate: ${existing.applicationNo} (${existing.cnicOrBForm})`
        );
        const fullStudent = await prisma.student.findUnique({
          where: { id: existing.id },
          include: {
            academicRecords: true,
            documents: true,
            officeUse: true,
          },
        });
        return this.formatStudentWithDocuments(fullStudent || existing);
      }

      const error: AppError = new Error(
        `A student with CNIC / B-Form '${input.cnicOrBForm}' is already registered.`
      );
      error.statusCode = 409;
      throw error;
    }

    const {
      academicRecords,
      documents,
      photoUrl: inputPhotoUrl,
      uploadedDocuments,
      signatureDataUrl,
      signature,
      ...baseData
    } = input as any;

    const rawDob =
      baseData.dateOfBirth && !isNaN(new Date(baseData.dateOfBirth).getTime())
        ? new Date(baseData.dateOfBirth)
        : new Date('2008-01-01');

    // Auto-discover pre-uploaded files in Supabase Storage under CNIC folder
    const cnicFolder = input.cnicOrBForm.replace(/[^\w-]/g, '_');
    const resolvedDocs: Record<string, any> = uploadedDocuments ? { ...uploadedDocuments } : {};
    let photoUrl = inputPhotoUrl;

    const sigData = signatureDataUrl || signature || (uploadedDocuments as any)?.signature?.dataUrl;
    if (sigData && !resolvedDocs['signature']) {
      resolvedDocs['signature'] = {
        name: `${input.fullName}_Digital_Signature.png`,
        size: 'Digital Pad Attached',
        dataUrl: sigData,
        uploadedAt: new Date().toISOString(),
      };
    }

    try {
      // 1. Check student-photos under CNIC folder
      const { data: photoFiles } = await (supabaseStorage as any).client?.storage?.from('student-photos')?.list(cnicFolder) || { data: [] };
      if (photoFiles && photoFiles.length > 0) {
        const latest = photoFiles[photoFiles.length - 1];
        const storagePath = `${cnicFolder}/${latest.name}`;
        const accessUrl = await supabaseStorage.getFileAccessUrl('student-photos', storagePath);
        if (!photoUrl) {
          photoUrl = accessUrl;
        }
        if (!resolvedDocs['photo']) {
          resolvedDocs['photo'] = {
            name: `${input.fullName}_Passport_Photo.jpg`,
            size: 'Cloud Storage Attached',
            publicUrl: accessUrl,
            supabasePath: storagePath,
            dataUrl: accessUrl,
            uploadedAt: latest.created_at || new Date().toISOString(),
          };
        }
      }

      // 2. Check student-documents under CNIC folder
      const { data: docFiles } = await (supabaseStorage as any).client?.storage?.from('student-documents')?.list(cnicFolder) || { data: [] };
      if (docFiles && docFiles.length > 0) {
        for (const file of docFiles) {
          const docType = file.name.split('_')[0] || 'document';
          const storagePath = `${cnicFolder}/${file.name}`;
          const accessUrl = await supabaseStorage.getFileAccessUrl('student-documents', storagePath);
          if (!resolvedDocs[docType]) {
            resolvedDocs[docType] = {
              name: `${input.fullName}_${file.name}`,
              size: 'Cloud Storage Attached',
              publicUrl: accessUrl,
              supabasePath: storagePath,
              dataUrl: accessUrl,
              uploadedAt: file.created_at || new Date().toISOString(),
            };
          }
        }
      }
    } catch (discoveryErr) {
      logger.warn('Supabase storage pre-upload discovery note:', discoveryErr);
    }

    const checklistData = {
      bformCnicCopy: Boolean(documents?.bformCnicCopy || resolvedDocs['bform'] || resolvedDocs['cnic']),
      fatherCnicCopy: Boolean(documents?.fatherCnicCopy || resolvedDocs['fatherCnic']),
      passportPhotos: Boolean(documents?.passportPhotos || resolvedDocs['photo'] || photoUrl),
      previousResultCard: Boolean(documents?.previousResultCard || resolvedDocs['dmc']),
      domicileCertificate: Boolean(documents?.domicileCertificate || resolvedDocs['domicile']),
      incomeCertificate: Boolean(documents?.incomeCertificate || resolvedDocs['paymentReceipt'] || resolvedDocs['income']),
      otherDocuments: documents?.otherDocuments || null,
    };

    let student: any = null;
    let lastError: any = null;

    // Retry loop to ensure zero unique constraint collision on applicationNo
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const applicationNo = await this.generateApplicationNumber();
        const qrToken = `PENDING-FEE-${applicationNo}`;

        // Persist inline base64 photo if provided
        if (photoUrl && photoUrl.startsWith('data:')) {
          const uploadRes = await supabaseStorage.uploadFile(
            'student-photos',
            `${applicationNo}-photo.png`,
            photoUrl,
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
            dateOfBirth: rawDob,
            photoUrl,
            uploadedDocsJson: Object.keys(resolvedDocs).length > 0 ? JSON.stringify(resolvedDocs) : null,
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
            documents: {
              create: checklistData,
            },
            officeUse: {
              create: {
                eligibility: null,
                finalStatus: null,
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

    // Mark student's registration fee records as PAID
    const paidAt = new Date();
    await prisma.feeRecord.updateMany({
      where: { studentId: student.id },
      data: {
        status: 'PAID',
        amountPaid: 300,
        paidAt,
      },
    });

    // Create FEE_INCOME transaction record if none exists for this student
    const existingFee = student.feeRecords[0];
    if (existingFee) {
      const existingTx = await prisma.transaction.findFirst({
        where: { relatedFeeId: existingFee.id },
      });
      if (!existingTx) {
        await prisma.transaction.create({
          data: {
            type: TransactionType.FEE_INCOME,
            amount: 300,
            description: `Registration Fee Collection (${student.fullName} - ${student.applicationNo})`,
            relatedFeeId: existingFee.id,
          },
        });
      }
    }

    const updatedStudent = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        academicRecords: true,
        documents: true,
        officeUse: true,
        feeRecords: true,
      },
    });

    return this.formatStudentWithDocuments(updatedStudent!);
  }

  async approvePayment(studentId: string) {
    return this.approveStudentPayment(studentId);
  }

  /**
   * Retrieves summary counts for roll number issuance.
   */
  async getRollNumberStatus() {
    const [readyCount, issuedCount, totalPaidCount, setting] = await Promise.all([
      prisma.student.count({
        where: {
          rollNumber: null,
          feeRecords: {
            some: {
              status: 'PAID',
            },
          },
        },
      }),
      prisma.student.count({
        where: {
          rollNumber: { not: null },
        },
      }),
      prisma.student.count({
        where: {
          feeRecords: {
            some: {
              status: 'PAID',
            },
          },
        },
      }),
      prisma.systemSetting.findUnique({
        where: { key: 'rollNumberScheduleDate' },
      }),
    ]);

    return {
      readyCount,
      issuedCount,
      totalPaidCount,
      scheduledDate: setting?.value || 'Sunday, 25 October 2026',
    };
  }

  /**
   * Retrieves official Roll Number release schedule config.
   */
  async getReleaseConfig() {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'rollNumberReleaseConfig' },
    });

    if (setting?.value) {
      try {
        return JSON.parse(setting.value);
      } catch (e) {}
    }

    return {
      isScheduled: false,
      releaseDateTime: '2026-10-15T09:00:00',
      announcementTitle: 'Roll Number Slips Official Release Schedule',
      announcementMessage:
        'Official Roll Number Slips, Assigned Test Centers, and Examination Hall seatings are live.',
      emergencyNotice:
        'Your registration and fee verification are permanently confirmed in the examination registry.',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates and persists official Roll Number release schedule config.
   */
  async saveReleaseConfig(config: any) {
    const payload = {
      isScheduled: Boolean(config.isScheduled),
      releaseDateTime: config.releaseDateTime || '2026-10-15T09:00:00',
      announcementTitle: config.announcementTitle || 'Roll Number Slips Official Release Schedule',
      announcementMessage: config.announcementMessage || '',
      emergencyNotice: config.emergencyNotice || '',
      updatedAt: new Date().toISOString(),
    };

    await prisma.systemSetting.upsert({
      where: { key: 'rollNumberReleaseConfig' },
      update: { value: JSON.stringify(payload) },
      create: { key: 'rollNumberReleaseConfig', value: JSON.stringify(payload) },
    });

    return payload;
  }

  /**
   * Public Candidate Roll Number Slip search method with exact priority, partial matching, and multi-match safeguards.
   */
  async searchPublicSlip(searchQuery: string) {
    const rawQuery = searchQuery.trim();
    const clean = rawQuery.toLowerCase();
    const cleanDigits = rawQuery.replace(/\D/g, '');

    if (!clean || (clean.length < 3 && cleanDigits.length < 3)) {
      return {
        success: false,
        error: 'Please enter at least 3 characters or digits (e.g. 0002, CNIC, or Roll Number) to search.',
      };
    }

    // Step 1: Attempt exact match first
    const exactClauses: any[] = [
      { rollNumber: { equals: clean, mode: 'insensitive' } },
      { applicationNo: { equals: clean, mode: 'insensitive' } },
      { id: { equals: rawQuery } },
      { cnicOrBForm: { equals: clean, mode: 'insensitive' } },
    ];

    const formattedCnic =
      cleanDigits.length === 13
        ? `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5, 12)}-${cleanDigits.slice(12)}`
        : null;

    if (formattedCnic) {
      exactClauses.push({ cnicOrBForm: { equals: formattedCnic, mode: 'insensitive' } });
    } else if (cleanDigits.length >= 11) {
      exactClauses.push({ cnicOrBForm: { equals: cleanDigits } });
    }

    let student = await prisma.student.findFirst({
      where: {
        OR: exactClauses,
      },
      include: {
        feeRecords: true,
        officeUse: true,
        documents: true,
      },
    });

    // Step 2: If no exact match, perform safe partial matching
    if (!student) {
      const partialClauses: any[] = [
        { rollNumber: { contains: clean, mode: 'insensitive' } },
        { applicationNo: { contains: clean, mode: 'insensitive' } },
        { cnicOrBForm: { contains: clean, mode: 'insensitive' } },
      ];

      if (formattedCnic) {
        partialClauses.push({ cnicOrBForm: { contains: formattedCnic, mode: 'insensitive' } });
      }

      if (cleanDigits.length >= 3) {
        partialClauses.push({ rollNumber: { contains: cleanDigits, mode: 'insensitive' } });
        partialClauses.push({ applicationNo: { contains: cleanDigits, mode: 'insensitive' } });
        partialClauses.push({ cnicOrBForm: { contains: cleanDigits, mode: 'insensitive' } });
      }

      if (clean.length >= 3) {
        partialClauses.push({ fullName: { contains: clean, mode: 'insensitive' } });
      }

      const matchingStudents = await prisma.student.findMany({
        where: {
          OR: partialClauses,
        },
        include: {
          feeRecords: true,
          officeUse: true,
          documents: true,
        },
        take: 5,
      });

      if (matchingStudents.length === 0) {
        return {
          success: false,
          error: `No matching candidate record found in examination registry for "${rawQuery}".`,
        };
      }

      // Safeguard: Multiple matches requires user to be more specific
      if (matchingStudents.length > 1) {
        return {
          success: false,
          error: `Multiple records match "${rawQuery}". To protect candidate privacy, please enter your full Roll Number (e.g. AZMVS-2026-0002), 13-digit CNIC, or Application ID.`,
        };
      }

      student = matchingStudents[0];
    }

    if (!student) {
      return {
        success: false,
        error: `No matching candidate record found in examination registry for "${rawQuery}".`,
      };
    }

    // Determine fee payment status
    const isFeePaid =
      student.status === 'ACTIVE' &&
      ((student.feeRecords && student.feeRecords.some((f) => f.status === 'PAID')) ||
        Boolean(student.rollNumber && student.rollNumber.startsWith('AZMVS')));

    if (!isFeePaid) {
      return {
        success: false,
        error: `Application Found (${student.fullName} - ${student.applicationNo}): Registration fee payment of PKR 300 is pending verification. Please deposit PKR 300 via EasyPaisa / JazzCash (03440197194 - Sumama Khan) or Faysal Bank (3126701000006213 - Sumama Khan) and send receipt to WhatsApp 0305-1755551 to activate your Roll Number Slip.`,
      };
    }

    // Check release schedule
    const releaseConfig = await this.getReleaseConfig();
    const isReleased =
      !releaseConfig.isScheduled ||
      !releaseConfig.releaseDateTime ||
      Date.now() >= new Date(releaseConfig.releaseDateTime).getTime();

    if (!student.rollNumber || !isReleased) {
      const dateFormatted = releaseConfig.releaseDateTime
        ? new Date(releaseConfig.releaseDateTime).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Official Release Schedule';
      const msg = !student.rollNumber
        ? `Registration fee payment of PKR 300 is confirmed! Official Roll Numbers and examination hall seating plans are scheduled for batch release on ${dateFormatted}. Please return on the release date to download your slip.`
        : releaseConfig.announcementMessage || 'Official Roll Number Slips are scheduled for release.';

      return {
        success: false,
        error: `SCHEDULED_RELEASE:::${student.fullName}:::${student.applicationNo}:::${dateFormatted}:::${msg}`,
      };
    }

    const rollNo = student.rollNumber;

    return {
      success: true,
      data: {
        rollNo: rollNo,
        applicationId: student.applicationNo || student.id || 'APP-2026',
        candidateName: student.fullName,
        fatherName: student.fatherName,
        cnicBForm: student.cnicOrBForm,
        classLevel: student.currentClass || 'SSC-II (Class 10th)',
        candidatePhoto:
          student.photoUrl ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        testCenter: student.officeUse?.testCentre || 'Main Campus Examination Center, Mansehra',
        centerAddress: 'Main College Road, Mansehra / Abbottabad Regional Center, KP',
        examDate: student.officeUse?.testDate || 'Sunday, 15 November 2026',
        reportingTime: student.officeUse?.testReportingTime || '09:00 AM',
        examStartTime: '10:00 AM - 12:00 PM (120 Mins)',
        roomNo: student.assignedRoom || 'HALL-01',
        seatIndex: student.seatNo || `SEAT-${rollNo.split('-').pop() || '0101'}`,
        instructions: [
          'Bring this original printed Roll Number Slip along with your original CNIC or B-Form to the examination center.',
          'Candidates must report to their assigned examination hall 45 minutes prior to the scheduled exam commencement time.',
          'Electronic devices, mobile phones, smartwatches, and programmable calculators are strictly prohibited inside the hall.',
          'Standard blue/black ballpoints and a transparent clipboard are permitted for optical answer sheet marking.',
          'Biometric verification will take place at the entrance gate before seating allocation.',
        ],
        issuedAt: student.updatedAt.toISOString(),
        qrPayload: `https://azmaio.com/verify?rollNo=${rollNo}&appId=${student.applicationNo}&cnic=${student.cnicOrBForm || ''}`,
      },
    };
  }

  /**
   * Batch issues sequential roll numbers and biometric QR codes for all students with fee status PAID but rollNumber null.
   */
  async issueRollNumbers(input?: { scheduledDate?: string }) {
    if (input?.scheduledDate) {
      await prisma.systemSetting.upsert({
        where: { key: 'rollNumberScheduleDate' },
        update: { value: input.scheduledDate },
        create: { key: 'rollNumberScheduleDate', value: input.scheduledDate },
      });
    }

    const eligibleStudents = await prisma.student.findMany({
      where: {
        rollNumber: null,
        feeRecords: {
          some: {
            status: 'PAID',
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        feeRecords: true,
        officeUse: true,
      },
    });

    if (eligibleStudents.length === 0) {
      return {
        message: 'No eligible candidates pending roll number issuance.',
        count: 0,
        students: [],
      };
    }

    const updatedStudents = [];

    for (const student of eligibleStudents) {
      const rollNumber = await this.generateRollNumber();
      const qrToken = qrService.generateSignedQrToken(rollNumber);
      const qrPayload = `https://azmaio.com/attend?token=${qrToken}`;
      const qrImageUrl = await qrService.generateQrDataUrl(qrPayload);

      try {
        await supabaseStorage.uploadFile('qr-codes', `${rollNumber}-qr.png`, qrImageUrl, 'image/png');
      } catch (storageErr) {
        console.warn(`Storage upload note for roll ${rollNumber}:`, storageErr);
      }

      const updated = await prisma.student.update({
        where: { id: student.id },
        data: {
          rollNumber,
          qrToken,
          qrImageUrl,
          officeUse: {
            upsert: {
              create: {
                testRollNo: rollNumber,
                eligibility: null,
                finalStatus: null,
                testCentre: 'Main Campus Examination Center, Mansehra',
                testReportingTime: '09:00 AM',
              },
              update: {
                testRollNo: rollNumber,
              },
            },
          },
        },
        include: {
          academicRecords: true,
          documents: true,
          officeUse: true,
          feeRecords: true,
        },
      });

      updatedStudents.push(this.formatStudentWithDocuments(updated));
    }

    return {
      message: `Successfully issued official roll numbers and biometric QR codes to ${updatedStudents.length} candidate(s).`,
      count: updatedStudents.length,
      students: updatedStudents,
    };
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

    if (query.gender && (query.gender as any) !== 'ALL') {
      where.gender = query.gender;
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
        { fatherName: { contains: s, mode: 'insensitive' } },
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
   * Generates and exports a branded PDF document of students matching applied filters
   */
  async exportStudentsPdf(query: StudentQueryInput): Promise<{ buffer: Buffer; filename: string }> {
    const where: any = {};

    if (query.status && (query.status as any) !== 'ALL') {
      where.status = query.status;
    }

    if (query.gender && (query.gender as any) !== 'ALL') {
      where.gender = query.gender;
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
        { fatherName: { contains: s, mode: 'insensitive' } },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      take: 2000,
      orderBy: [{ currentClass: 'asc' }, { fullName: 'asc' }],
      include: {
        academicRecords: true,
        documents: true,
        officeUse: true,
        feeRecords: true,
      },
    });

    const formattedStudents = students.map((s) => this.formatStudentWithDocuments(s));
    const html = pdfService.generateStudentsListHtml(formattedStudents, query, formattedStudents.length);
    const buffer = await pdfService.generatePdfFromHtml(html, { landscape: true });

    // Generate descriptive filename: AZM-Students-Class10-Female-2026-08-28.pdf
    const parts: string[] = ['AZM', 'Students'];
    if (query.classLevel && query.classLevel !== 'ALL') {
      parts.push(query.classLevel.replace(/[^a-zA-Z0-9]/g, ''));
    }
    if (query.gender && (query.gender as any) !== 'ALL') {
      parts.push(String(query.gender).toLowerCase() === 'female' ? 'Female' : 'Male');
    }
    if (query.status && (query.status as any) !== 'ALL') {
      parts.push(String(query.status));
    }
    const today = new Date().toISOString().split('T')[0];
    parts.push(today);
    const filename = `${parts.join('-')}.pdf`;

    return { buffer, filename };
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
   * Deletes a student record and cascade-deletes all associated transactions, fee records, and documents.
   */
  async deleteStudent(id: string) {
    const student = await this.getStudentById(id);

    // 1. Find all fee record IDs for this student
    const feeIds = student.feeRecords?.map((f: any) => f.id) || [];
    const appNo = student.applicationNo;
    const stdId = student.id;

    // 2. Cascade delete all linked General Ledger transactions
    const orConditions: any[] = [];
    if (feeIds.length > 0) {
      orConditions.push({ relatedFeeId: { in: feeIds } });
    }
    if (appNo) {
      orConditions.push({ description: { contains: appNo } });
    }
    if (stdId) {
      orConditions.push({ description: { contains: stdId } });
    }

    if (orConditions.length > 0) {
      const deletedTxCount = await prisma.transaction.deleteMany({
        where: { OR: orConditions },
      });
      console.log(
        `[AUDIT] Cascaded deletion of ${deletedTxCount.count} transaction(s) for deleted student ${student.fullName} (${student.applicationNo || id}) at ${new Date().toISOString()}`
      );
    }

    // 3. Delete student (Prisma cascades academicRecords, documents, officeUse, attendance, feeRecords)
    return prisma.student.delete({
      where: { id },
    });
  }

  /**
   * Retrieves QR metadata and binary buffer for a student.
   */
  async getStudentQr(id: string) {
    const student = await this.getStudentById(id);
    const qrPayload = `https://azmaio.com/attend?token=${student.qrToken}`;
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
  /**
   * Resolves student photo to a reliable base64 data URI for seamless embedding into PDFs.
   */
  /**
   * Resolves student photo to a reliable base64 data URI for seamless embedding into PDFs.
   */
  async resolveStudentPhotoBase64(student: any): Promise<string> {
    const defaultPlaceholder = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150" viewBox="0 0 120 150">
        <rect width="120" height="150" fill="#f8fafc"/>
        <circle cx="60" cy="50" r="25" fill="#94a3b8"/>
        <path d="M20 125 C20 90, 100 90, 100 125 Z" fill="#64748b"/>
        <text x="60" y="142" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#475569" text-anchor="middle">PHOTO</text>
      </svg>`
    )}`;

    if (!student) return defaultPlaceholder;

    const uploadedDocs = typeof student.uploadedDocsJson === 'string'
      ? (() => { try { return JSON.parse(student.uploadedDocsJson); } catch { return {}; } })()
      : student.uploadedDocuments || {};

    const candidates: string[] = [
      uploadedDocs?.photo?.dataUrl,
      uploadedDocs?.photo?.publicUrl,
      uploadedDocs?.photo?.url,
      student.photoUrl,
    ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

    for (const raw of candidates) {
      if (raw.startsWith('data:image/')) {
        return raw;
      }

      // Check if it is a Supabase storage path or signed URL
      if (raw.includes('student-photos/')) {
        try {
          const urlWithoutQuery = raw.split('?')[0];
          const parts = urlWithoutQuery.split('student-photos/');
          const pathInBucket = parts[1];
          if (pathInBucket) {
            const buffer = await supabaseStorage.downloadFile('student-photos', decodeURIComponent(pathInBucket));
            if (buffer && buffer.length > 0) {
              const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
              const mime = isPng ? 'image/png' : 'image/jpeg';
              return `data:${mime};base64,${buffer.toString('base64')}`;
            }
          }
        } catch (storageErr) {
          logger.warn('Supabase storage photo download note:', storageErr);
        }
      }

      // If it is an HTTP or HTTPS URL, fetch server-side
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        try {
          const client = raw.startsWith('https') ? https : http;
          const buffer = await new Promise<Buffer | null>((resolve) => {
            client.get(raw, (res: any) => {
              if (res.statusCode !== 200) {
                return resolve(null);
              }
              const chunks: Buffer[] = [];
              res.on('data', (c: Buffer) => chunks.push(c));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', () => resolve(null));
          });

          if (buffer && buffer.length > 0) {
            const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
            const mime = isPng ? 'image/png' : 'image/jpeg';
            return `data:${mime};base64,${buffer.toString('base64')}`;
          }
        } catch (fetchErr) {
          logger.warn('Failed to fetch photo from external URL server-side:', fetchErr);
        }
      }
    }

    // Direct supabasePath in uploadedDocuments
    if (uploadedDocs?.photo?.supabasePath) {
      try {
        const buffer = await supabaseStorage.downloadFile('student-photos', uploadedDocs.photo.supabasePath);
        if (buffer && buffer.length > 0) {
          const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
          const mime = isPng ? 'image/png' : 'image/jpeg';
          return `data:${mime};base64,${buffer.toString('base64')}`;
        }
      } catch (err) {
        logger.warn('Failed to download student photo via supabasePath:', err);
      }
    }

    // Discovery in Supabase storage by CNIC folder
    if (student.cnicOrBForm) {
      try {
        const cnicFolder = student.cnicOrBForm.replace(/[^\w-]/g, '_');
        const { data: photoFiles } = await (supabaseStorage as any).client?.storage?.from('student-photos')?.list(cnicFolder) || { data: [] };
        if (photoFiles && photoFiles.length > 0) {
          const latest = photoFiles[photoFiles.length - 1];
          const storagePath = `${cnicFolder}/${latest.name}`;
          const buffer = await supabaseStorage.downloadFile('student-photos', storagePath);
          if (buffer && buffer.length > 0) {
            const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
            const mime = isPng ? 'image/png' : 'image/jpeg';
            return `data:${mime};base64,${buffer.toString('base64')}`;
          }
        }
      } catch (discErr) {
        logger.warn('Storage discovery fallback error:', discErr);
      }
    }

    return defaultPlaceholder;
  }

  /**
   * Generates Registration PDF buffer for downloading.
   */
  async getRegistrationPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const student = await this.getStudentById(id);
    const photoBase64 = await this.resolveStudentPhotoBase64(student);
    const html = pdfService.generateStudentRegistrationHtml(student, photoBase64);
    const buffer = await pdfService.generatePdfFromHtml(html);
    const filename = `AZM-Registration-${student.applicationNo || student.id}.pdf`;

    return { buffer, filename };
  }

  /**
   * Generates Roll Number Slip Exam Entry Pass PDF buffer for downloading.
   */
  async getRollSlipPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const student = await this.getStudentById(id);
    if (!student) {
      const err: AppError = new Error('Candidate record not found in database.');
      err.statusCode = 404;
      throw err;
    }

    if (!student.rollNumber) {
      const err: AppError = new Error(
        'Roll number has not been issued yet for this candidate. Candidate must have a verified fee payment and issued roll number before downloading the exam entry pass.'
      );
      err.statusCode = 400;
      throw err;
    }

    let qrDataUrl = '';
    try {
      const QRCode = await import('qrcode');
      const qrPayload = student.qrToken || `https://azmaio.com/verify?rollNo=${student.rollNumber}&appId=${student.applicationNo}&cnic=${student.cnicOrBForm || ''}`;
      qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (qrErr) {
      logger.warn('QRCode generation fallback for PDF:', qrErr);
    }

    const photoBase64 = await this.resolveStudentPhotoBase64(student);
    const html = pdfService.generateRollSlipHtml(student, qrDataUrl, photoBase64);
    const buffer = await pdfService.generatePdfFromHtml(html);
    const filename = `RollNoSlip-${student.rollNumber}.pdf`;

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
    // Validate MIME type and file size
    let mimeType = input.contentType?.toLowerCase();
    let byteLength = 0;

    if (input.fileData.startsWith('data:')) {
      const match = input.fileData.match(/^data:([^;]+);base64,(.*)$/s);
      if (match) {
        if (!mimeType) {
          mimeType = match[1].toLowerCase();
        }
        byteLength = Buffer.byteLength(match[2], 'base64');
      } else {
        byteLength = Buffer.byteLength(input.fileData);
      }
    } else {
      byteLength = Buffer.byteLength(input.fileData, 'base64');
    }

    if (mimeType === 'image/jpg') {
      mimeType = 'image/jpeg';
    }

    if (!mimeType && input.fileName) {
      const ext = input.fileName.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'pdf') mimeType = 'application/pdf';
    }

    if (!mimeType || !ALLOWED_FILE_MIME_TYPES.includes(mimeType as any)) {
      const error: AppError = new Error(
        `Invalid file type "${mimeType || 'unknown'}". Only JPEG, PNG, and PDF files are allowed.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (byteLength > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (byteLength / (1024 * 1024)).toFixed(2);
      const error: AppError = new Error(
        `File size (${sizeMb}MB) exceeds the maximum allowed limit of 5MB.`
      );
      error.statusCode = 400;
      throw error;
    }

    const rawApp = (input.applicationNo || input.cnicOrBForm || input.studentId || 'DOC').replace(/[^\w-]/g, '_');
    const ext = input.fileName?.split('.').pop() || (mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg');
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

    const publicUrl = await supabaseStorage.getFileAccessUrl(bucket, pathName, 60 * 60 * 24 * 30);

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

    // 3. Check Supabase Cloud Storage
    if (student) {
      if (student.uploadedDocsJson) {
        try {
          const docs = JSON.parse(student.uploadedDocsJson);
          const doc = docs[docType] || docs[`${docType}Uploaded`];
          if (doc?.supabasePath) {
            const bucket: StorageBucket = docType === 'photo' ? 'student-photos' : 'student-documents';
            const buf = await supabaseStorage.downloadFile(bucket, doc.supabasePath);
            if (buf) {
              const mime = doc.supabasePath.endsWith('.pdf')
                ? 'application/pdf'
                : doc.supabasePath.endsWith('.png')
                ? 'image/png'
                : 'image/jpeg';
              return { buffer: buf, contentType: mime };
            }
          }
        } catch (e) {}
      }

      // Check storage directly under candidate applicationNo or CNIC
      const bucket: StorageBucket = docType === 'photo' ? 'student-photos' : 'student-documents';
      for (const prefix of [student.applicationNo, student.cnicOrBForm].filter(Boolean) as string[]) {
        const cleanPrefix = prefix.replace(/[^\w-]/g, '_');
        try {
          const { data: files } = await (supabaseStorage as any).client?.storage?.from(bucket)?.list(cleanPrefix) || { data: [] };
          const match = (files || []).find((f: any) => f.name.startsWith(`${docType}_`) || f.name.startsWith(docType));
          if (match) {
            const storagePath = `${cleanPrefix}/${match.name}`;
            const buf = await supabaseStorage.downloadFile(bucket, storagePath);
            if (buf) {
              const mime = match.name.endsWith('.pdf')
                ? 'application/pdf'
                : match.name.endsWith('.png')
                ? 'image/png'
                : 'image/jpeg';
              return { buffer: buf, contentType: mime };
            }
          }
        } catch {}
      }
    }

    // 4. Fallback placeholder SVG (genuine last resort)
    logger.warn(
      `Document "${docType}" not found on disk or Supabase Storage for student "${studentIdentifier}". Returning fallback placeholder.`
    );
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

    // 4. Empty Supabase Storage buckets (including sensitive student documents)
    await Promise.all([
      supabaseStorage.emptyBucket('student-photos'),
      supabaseStorage.emptyBucket('qr-codes'),
      supabaseStorage.emptyBucket('registration-pdfs'),
      supabaseStorage.emptyBucket('student-documents'),
    ]);

    return {
      success: true,
      message: 'All student records, fee logs, attendance entries, partner schools, staff records, and storage attachments have been purged successfully.',
      timestamp: new Date().toISOString(),
    };
  }
}

export const studentsService = new StudentsService();
