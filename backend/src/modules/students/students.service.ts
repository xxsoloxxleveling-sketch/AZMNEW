import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
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

const metadataOnlyDocuments = (documents: Record<string, any> | undefined) => {
  const clean: Record<string, any> = {};
  for (const [docType, document] of Object.entries(documents || {})) {
    if (!document || typeof document !== 'object' || !document.supabasePath) continue;
    clean[docType] = {
      name: document.name || `${docType} document`,
      bucket: document.bucket || (docType.startsWith('photo') ? 'student-photos' : 'student-documents'),
      supabasePath: document.supabasePath,
      mimeType: document.mimeType || document.fileType || 'application/octet-stream',
      byteSize: Number(document.byteSize) || undefined,
      checksumSha256: document.checksumSha256 || undefined,
      uploadedAt: document.uploadedAt || new Date().toISOString(),
    };
  }
  return clean;
};

const isMissingStudentDocumentTable = (error: any) =>
  error?.code === 'P2021' && String(error?.meta?.table || error?.message || '').includes('StudentDocument');

export class StudentsService {
  async verifyCandidateIdentity(studentIdentifier: string, cnicOrBForm: string): Promise<boolean> {
    const normalized = cnicOrBForm.replace(/\D/g, '');
    if (normalized.length < 5) return false;
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: studentIdentifier },
          { applicationNo: studentIdentifier },
        ],
      },
      select: { cnicOrBForm: true },
    });
    return Boolean(student && student.cnicOrBForm.replace(/\D/g, '') === normalized);
  }

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

    for (const document of student.studentDocuments || []) {
      uploadedDocuments[document.documentType] = {
        name: document.originalFileName || `${document.documentType} document`,
        bucket: document.bucket,
        supabasePath: document.objectPath,
        mimeType: document.mimeType,
        byteSize: document.byteSize,
        checksumSha256: document.checksumSha256,
        uploadedAt: document.createdAt,
      };
    }

    if (student.photoUrl && !uploadedDocuments.photo) {
      uploadedDocuments.photo = {
        name: `${student.fullName}_Passport_Photo.jpg`,
        size: 'Legacy candidate photo',
        uploadedAt: student.createdAt,
      };
    }

    const documentMetadata: Record<string, any> = {};
    for (const [docType, document] of Object.entries(uploadedDocuments)) {
      if (docType === 'photoThumbnail') continue;
      const doc: any = typeof document === 'object' && document !== null ? document : { name: `${docType} document` };
      documentMetadata[docType] = {
        name: doc?.name || `${docType} document`,
        size: doc?.size || (doc?.byteSize ? `${Math.ceil(doc.byteSize / 1024)} KB` : 'Candidate attachment'),
        bucket: doc?.bucket || (docType.startsWith('photo') ? 'student-photos' : 'student-documents'),
        supabasePath: doc?.supabasePath,
        mimeType: doc?.mimeType || doc?.fileType || 'application/octet-stream',
        byteSize: doc?.byteSize,
        checksumSha256: doc?.checksumSha256,
        uploadedAt: doc?.uploadedAt || student.createdAt,
        fileEndpoint: student.id ? `/api/students/${student.id}/document/${docType}` : undefined,
      };
    }

    // Determine accurate fee status across feeRecords & rollNumber issuance
    const isPaid =
      student.feeStatus === 'PAID' ||
      (student.feeRecords && Array.isArray(student.feeRecords) && student.feeRecords.some((f: any) => f.status === 'PAID')) ||
      Boolean(student.rollNumber);
    const feeStatus = isPaid ? 'PAID' : (student.feeRecords?.[0]?.status || 'UNPAID');

    const { uploadedDocsJson, ...cleanStudent } = student;

    return {
      ...cleanStudent,
      photoUrl: null,
      // A list query can provide the small metadata relation without retrieving
      // legacy photo/base64 columns. Legacy records become visible after backfill.
      hasPhoto: Boolean(
        student.photoUrl ||
          uploadedDocuments.photo ||
          student.studentDocuments?.some((document: any) =>
            ['photo', 'photoThumbnail'].includes(document.documentType)
          )
      ),
      feeStatus,
      uploadedDocuments: Object.keys(documentMetadata).length > 0 ? documentMetadata : undefined,
    };
  }

  async persistDocumentMetadata(studentId: string, documents: Record<string, any>) {
    for (const [documentType, document] of Object.entries(metadataOnlyDocuments(documents))) {
      await prisma.studentDocument.upsert({
        where: {
          bucket_objectPath: {
            bucket: document.bucket,
            objectPath: document.supabasePath,
          },
        },
        update: {
          studentId,
          documentType,
          originalFileName: document.name,
          mimeType: document.mimeType,
          byteSize: document.byteSize,
          checksumSha256: document.checksumSha256,
        },
        create: {
          studentId,
          documentType,
          bucket: document.bucket,
          objectPath: document.supabasePath,
          originalFileName: document.name,
          mimeType: document.mimeType,
          byteSize: document.byteSize,
          checksumSha256: document.checksumSha256,
        },
      });
    }
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
      requireCompleteDocuments,
      ...baseData
    } = input as any;

    const rawDob =
      baseData.dateOfBirth && !isNaN(new Date(baseData.dateOfBirth).getTime())
        ? new Date(baseData.dateOfBirth)
        : new Date('2008-01-01');

    // Auto-discover pre-uploaded files in Supabase Storage under CNIC folder
    const cnicFolder = input.cnicOrBForm.replace(/[^\w-]/g, '_');
    const resolvedDocs: Record<string, any> = metadataOnlyDocuments(uploadedDocuments);
    let photoUrl = inputPhotoUrl;

    const sigData = signatureDataUrl || signature || (uploadedDocuments as any)?.signature?.dataUrl;

    try {
      // 1. Check student-photos under CNIC folder
      const { data: photoFiles } = await (supabaseStorage as any).client?.storage?.from('student-photos')?.list(cnicFolder) || { data: [] };
      if (photoFiles && photoFiles.length > 0) {
        const latest = photoFiles.find((file: any) => /^photo\.[^.]+$/i.test(file.name)) || photoFiles[photoFiles.length - 1];
        const storagePath = `${cnicFolder}/${latest.name}`;
        if (!resolvedDocs['photo']) {
          resolvedDocs['photo'] = {
            name: `${input.fullName}_Passport_Photo.jpg`,
            bucket: 'student-photos',
            supabasePath: storagePath,
            mimeType: latest.name.endsWith('.png') ? 'image/png' : 'image/jpeg',
            uploadedAt: latest.created_at || new Date().toISOString(),
          };
        }
      }

      // 2. Check student-documents under CNIC folder
      const { data: docFiles } = await (supabaseStorage as any).client?.storage?.from('student-documents')?.list(cnicFolder) || { data: [] };
      if (docFiles && docFiles.length > 0) {
        for (const file of docFiles) {
          const docType = path.parse(file.name).name.split('_')[0] || 'document';
          const storagePath = `${cnicFolder}/${file.name}`;
          if (!resolvedDocs[docType]) {
            resolvedDocs[docType] = {
              name: `${input.fullName}_${file.name}`,
              bucket: 'student-documents',
              supabasePath: storagePath,
              mimeType: file.name.endsWith('.pdf')
                ? 'application/pdf'
                : file.name.endsWith('.png')
                ? 'image/png'
                : 'image/jpeg',
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

        // Legacy clients may still submit an inline photo. Upload it once, then
        // retain only metadata so new database rows never contain file bytes.
        if (photoUrl && photoUrl.startsWith('data:')) {
          const match = photoUrl.match(/^data:([^;]+);base64,(.*)$/s);
          const mimeType = match?.[1] || 'image/png';
          const photoBuffer = Buffer.from(match?.[2] || '', 'base64');
          const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
          const storagePath = `${cnicFolder}/photo.${extension}`;
          const uploadRes = await supabaseStorage.uploadFile(
            'student-photos',
            storagePath,
            photoBuffer,
            mimeType
          );
          if (!uploadRes.error) {
            resolvedDocs.photo = {
              name: `${input.fullName}_Passport_Photo.${extension}`,
              bucket: 'student-photos',
              supabasePath: storagePath,
              mimeType,
              byteSize: photoBuffer.length,
              checksumSha256: crypto.createHash('sha256').update(photoBuffer).digest('hex'),
              uploadedAt: new Date().toISOString(),
            };

            // Auto-generate 160x160 MozJPEG thumbnail immediately on registration
            try {
              const thumbBuffer = await sharp(photoBuffer)
                .resize(160, 160, { fit: 'cover', position: 'center' })
                .jpeg({ quality: 80, mozjpeg: true })
                .toBuffer();
              const thumbPath = `${cnicFolder}/photo_thumbnail.jpg`;
              const thumbRes = await supabaseStorage.uploadFile(
                'student-photos',
                thumbPath,
                thumbBuffer,
                'image/jpeg'
              );
              if (!thumbRes.error) {
                resolvedDocs.photoThumbnail = {
                  name: 'photo_thumbnail.jpg',
                  bucket: 'student-photos',
                  supabasePath: thumbPath,
                  mimeType: 'image/jpeg',
                  byteSize: thumbBuffer.length,
                  checksumSha256: crypto.createHash('sha256').update(thumbBuffer).digest('hex'),
                  uploadedAt: new Date().toISOString(),
                };
              }
            } catch (thumbErr) {
              logger.warn('Failed to auto-generate thumbnail during registration:', thumbErr);
            }
          }
        }

        if (sigData && typeof sigData === 'string' && sigData.startsWith('data:')) {
          const match = sigData.match(/^data:([^;]+);base64,(.*)$/s);
          const signatureBuffer = Buffer.from(match?.[2] || '', 'base64');
          const signaturePath = `${cnicFolder}/signature.png`;
          const uploadRes = await supabaseStorage.uploadFile(
            'student-documents',
            signaturePath,
            signatureBuffer,
            match?.[1] || 'image/png'
          );
          if (!uploadRes.error) {
            resolvedDocs.signature = {
              name: `${input.fullName}_Digital_Signature.png`,
              bucket: 'student-documents',
              supabasePath: signaturePath,
              mimeType: match?.[1] || 'image/png',
              byteSize: signatureBuffer.length,
              checksumSha256: crypto.createHash('sha256').update(signatureBuffer).digest('hex'),
              uploadedAt: new Date().toISOString(),
            };
          }
        }

        // Upload any other documents provided as inline dataUrls that do not have a supabasePath yet
        for (const [docKey, docVal] of Object.entries(uploadedDocuments || {})) {
          if (docKey === 'photo' || docKey === 'photoThumbnail' || docKey === 'signature') continue;
          if (resolvedDocs[docKey]?.supabasePath) continue;
          if (docVal && typeof docVal === 'object') {
            const rawDataUrl = (docVal as any).dataUrl || (docVal as any).fileData;
            if (rawDataUrl && typeof rawDataUrl === 'string' && rawDataUrl.startsWith('data:')) {
              const match = rawDataUrl.match(/^data:([^;]+);base64,(.*)$/s);
              if (match) {
                const mimeType = match[1] || 'image/jpeg';
                const buffer = Buffer.from(match[2], 'base64');
                const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
                const storagePath = `${cnicFolder}/${docKey}.${ext}`;
                const uploadRes = await supabaseStorage.uploadFile(
                  'student-documents',
                  storagePath,
                  buffer,
                  mimeType
                );
                if (!uploadRes.error) {
                  resolvedDocs[docKey] = {
                    name: (docVal as any).name || `${input.fullName}_${docKey}.${ext}`,
                    bucket: 'student-documents',
                    supabasePath: storagePath,
                    mimeType,
                    byteSize: buffer.length,
                    checksumSha256: crypto.createHash('sha256').update(buffer).digest('hex'),
                    uploadedAt: new Date().toISOString(),
                  };
                }
              }
            }
          }
        }

        if (requireCompleteDocuments) {
          const requiredDocumentTypes = ['photo', 'bform', 'fatherCnic', 'dmc', 'signature'];
          const missing = requiredDocumentTypes.filter((docType) => !resolvedDocs[docType]?.supabasePath);
          if (missing.length > 0) {
            const error: AppError = new Error(
              `Registration was not saved because these required documents are not safely stored: ${missing.join(', ')}. Please upload them again.`
            );
            error.statusCode = 502;
            throw error;
          }

          for (const docType of requiredDocumentTypes) {
            const document = resolvedDocs[docType];
            const bucket: StorageBucket = docType === 'photo' ? 'student-photos' : 'student-documents';
            const objectPath = String(document.supabasePath || '');
            if (
              document.bucket !== bucket ||
              !objectPath.startsWith(`${cnicFolder}/`) ||
              !(await supabaseStorage.fileExists(bucket, objectPath))
            ) {
              const error: AppError = new Error(
                `Registration was not saved because the ${docType} upload could not be verified. Please upload it again.`
              );
              error.statusCode = 502;
              throw error;
            }
          }
        }

        student = await prisma.student.create({
          data: {
            ...baseData,
            dateOfBirth: rawDob,
            photoUrl: null,
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

    await this.persistDocumentMetadata(student.id, resolvedDocs);

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
        studentDocuments: true,
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
  async searchPublicSlip(searchQuery: string, cnicOrBForm: string) {
    const rawQuery = searchQuery.trim();
    const clean = rawQuery.toLowerCase();
    const cnicDigits = cnicOrBForm.replace(/\D/g, '');

    if (!clean || cnicDigits.length < 5) {
      return {
        success: false,
        error: 'Enter your complete CNIC / B-Form exactly as registered to access your slip.',
      };
    }

    // Step 1: Attempt exact match first
    const formattedCnic =
      cnicDigits.length === 13
        ? `${cnicDigits.slice(0, 5)}-${cnicDigits.slice(5, 12)}-${cnicDigits.slice(12)}`
        : null;

    // A slip is personal information.  Never fall back to partial identifiers or
    // candidate names here: both the requested identifier and the CNIC/B-form
    // must match the same record exactly.
    const registeredIdentity = [
      { cnicOrBForm: { equals: cnicOrBForm } },
      ...(formattedCnic ? [{ cnicOrBForm: { equals: formattedCnic } }] : []),
    ];

    const student = await prisma.student.findFirst({
      where: {
        AND: [
          {
            OR: [
              { rollNumber: { equals: clean, mode: 'insensitive' } },
              { applicationNo: { equals: clean, mode: 'insensitive' } },
              { id: { equals: rawQuery } },
              ...registeredIdentity,
            ],
          },
          { OR: registeredIdentity },
        ],
      },
      include: {
        feeRecords: true,
        officeUse: true,
        documents: true,
      },
    });

    if (!student) {
      return { success: false, error: 'No matching application was found. Check the application number and CNIC / B-Form.' };
    }

    // Determine fee payment status
    const isFeePaid =
      student.status === 'ACTIVE' &&
      ((student.feeRecords && student.feeRecords.some((f) => f.status === 'PAID')) ||
        Boolean(student.rollNumber && student.rollNumber.startsWith('AZMVS')));

    if (!isFeePaid) {
      return {
        success: false,
        error: `Application Found (${student.fullName} - ${student.applicationNo}): Registration fee payment of PKR 300 is pending verification. Please deposit PKR 300 via EasyPaisa / JazzCash (03440197194 - Sumama Khan) or Bank Alfalah (83861010161490 - Sumama Khan) and send receipt to WhatsApp 0305-1755551 to activate your Roll Number Slip.`,
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
          (student.photoUrl && !student.photoUrl.includes('unsplash') ? student.photoUrl : null) ||
          `/api/students/${student.id}/photo-thumbnail?cnic=${encodeURIComponent(student.cnicOrBForm)}`,
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
   * Candidate self-service lookup. The response deliberately contains only the
   * minimum details needed to identify a verified application and download its
   * registration PDF.
   */
  async findPublicRegistration(applicationIdentifier: string, cnicOrBForm: string) {
    const identifier = applicationIdentifier.trim();
    const cnicDigits = cnicOrBForm.replace(/\D/g, '');
    if (!identifier || cnicDigits.length < 5) {
      return { success: false, error: 'Enter your application ID and complete CNIC / B-Form.' };
    }

    const formattedCnic = cnicDigits.length === 13
      ? `${cnicDigits.slice(0, 5)}-${cnicDigits.slice(5, 12)}-${cnicDigits.slice(12)}`
      : null;
    const student = await prisma.student.findFirst({
      where: {
        AND: [
          {
            OR: [
              { applicationNo: { equals: identifier, mode: 'insensitive' } },
              { id: { equals: identifier } },
            ],
          },
          {
            OR: [
              { cnicOrBForm: { equals: cnicOrBForm } },
              ...(formattedCnic ? [{ cnicOrBForm: { equals: formattedCnic } }] : []),
            ],
          },
        ],
      },
      select: {
        id: true,
        applicationNo: true,
        fullName: true,
        fatherName: true,
        currentClass: true,
        status: true,
        feeRecords: { select: { status: true } },
      },
    });

    if (!student) return { success: false, error: 'No matching application was found. Check both entries and try again.' };
    return {
      success: true,
      data: {
        ...student,
        feeStatus: student.feeRecords.some((fee) => fee.status === 'PAID') ? 'PAID' : 'UNPAID',
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
          studentDocuments: true,
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
    const limit = Math.min(parseInt(String(query.limit || 50), 10) || 50, 250);
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

    const listStudents = (includeDocumentMetadata: boolean) =>
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          applicationNo: true,
          rollNumber: true,
          fullName: true,
          fatherName: true,
          gender: true,
          dateOfBirth: true,
          age: true,
          cnicOrBForm: true,
          studentMobile: true,
          parentMobile: true,
          whatsapp: true,
          currentClass: true,
          hsscGroup: true,
          schoolName: true,
          scholarshipCategory: true,
          status: true,
          createdAt: true,
          feeRecords: { select: { status: true, amountDue: true, amountPaid: true } },
          officeUse: { select: { eligibility: true, eligibilityRemarks: true } },
          ...(includeDocumentMetadata
            ? {
                studentDocuments: {
                  where: { documentType: { in: ['photo', 'photoThumbnail'] } },
                  select: { documentType: true },
                  take: 1,
                },
              }
            : {}),
        },
      });

    let students: any[];
    let total: number;
    try {
      [students, total] = await Promise.all([listStudents(true), prisma.student.count({ where })]);
    } catch (error) {
      if (!isMissingStudentDocumentTable(error)) throw error;
      // Keep the roster operational during a rolling deployment. This fallback
      // deliberately does not retrieve legacy photo/blob columns.
      logger.warn('StudentDocument migration is pending; serving lightweight compatibility roster.');
      [students, total] = await Promise.all([listStudents(false), prisma.student.count({ where })]);
    }

    return {
      students: students.map((s) => ({
        ...this.formatStudentWithDocuments(s),
        // List responses intentionally never retrieve or serialize file bytes.
        photoUrl: null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getDocumentMetadata(query: { page?: string; limit?: string; studentId?: string }) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit || 24), 10) || 24));
    const where = query.studentId ? { studentId: query.studentId } : {};
    const [documents, total] = await Promise.all([
      prisma.studentDocument.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              rollNumber: true,
              applicationNo: true,
              currentClass: true,
              createdAt: true,
              officeUse: { select: { eligibility: true, eligibilityRemarks: true } },
            },
          },
        },
      }),
      prisma.studentDocument.count({ where }),
    ]);

    return {
      documents: documents.map((document) => ({
        id: document.id,
        studentId: document.studentId,
        studentName: document.student.fullName,
        rollNumber: document.student.rollNumber || 'PENDING',
        applicationNo: document.student.applicationNo,
        currentClass: document.student.currentClass,
        documentType: document.documentType,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        byteSize: document.byteSize,
        uploadedAt: document.createdAt,
        fileEndpoint: `/api/students/${document.studentId}/document/${document.documentType}`,
        eligibility: document.student.officeUse?.eligibility,
        eligibilityRemarks: document.student.officeUse?.eligibilityRemarks,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
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

    // A roster with embedded portrait thumbnails is intentionally capped. This
    // keeps a single administrative export within the Render memory budget.
    const students = await prisma.student.findMany({
      where,
      take: 250,
      orderBy: [{ currentClass: 'asc' }, { fullName: 'asc' }],
      include: {
        academicRecords: true,
        documents: true,
        officeUse: true,
        feeRecords: true,
        studentDocuments: true,
      },
    });

    const formattedStudents = students.map((s) => this.formatStudentWithDocuments(s));

    // Fetch only the already-created 160px private thumbnail.  Do not fetch
    // originals or create images while exporting: that was the source of the
    // Render memory spikes. Three downloads at a time keeps the export stable.
    let nextIndex = 0;
    const addPortraitWorker = async () => {
      while (nextIndex < students.length) {
        const index = nextIndex++;
        const source = students[index];
        const thumbnail = source.studentDocuments.find((document) => document.documentType === 'photoThumbnail');
        if (!thumbnail) continue;
        try {
          const buffer = await supabaseStorage.downloadFile(thumbnail.bucket as StorageBucket, thumbnail.objectPath);
          if (buffer?.length) {
            formattedStudents[index].rosterPhotoDataUrl = `data:${thumbnail.mimeType};base64,${buffer.toString('base64')}`;
          }
        } catch (error) {
          logger.warn(`Roster portrait skipped for ${source.applicationNo || source.id}:`, error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, students.length) }, addPortraitWorker));

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
    let student = await prisma.student.findUnique({
      where: { id },
      include: {
        academicRecords: true,
        documents: true,
        officeUse: true,
        feeRecords: true,
        studentDocuments: true,
      },
    });

    if (!student) {
      student = await prisma.student.findFirst({
        where: {
          OR: [
            { applicationNo: id },
            { cnicOrBForm: id },
            { rollNumber: id },
          ],
        },
        include: {
          academicRecords: true,
          documents: true,
          officeUse: true,
          feeRecords: true,
          studentDocuments: true,
        },
      });
    }

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

      // Do not fetch arbitrary legacy HTTP URLs. They can be attacker-controlled
      // and can exhaust the Render instance or reach internal services. Existing
      // photos should be migrated into the private student-photos bucket instead.
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

    // Legacy records may still hold an embedded photo. Read it only for this
    // explicitly requested PDF; it is never included in normal API responses.
    if (student.id) {
      try {
        const legacyStudent = await prisma.student.findUnique({
          where: { id: student.id },
          select: { photoUrl: true, uploadedDocsJson: true },
        });
        const legacyPhoto = legacyStudent?.photoUrl;
        if (legacyPhoto?.startsWith('data:image/')) return legacyPhoto;

        const legacyDocuments = legacyStudent?.uploadedDocsJson
          ? JSON.parse(legacyStudent.uploadedDocsJson)
          : {};
        const legacyPath = legacyDocuments?.photo?.supabasePath;
        if (legacyPath) {
          const buffer = await supabaseStorage.downloadFile('student-photos', legacyPath);
          if (buffer?.length) {
            const mime = buffer[0] === 0x89 && buffer[1] === 0x50 ? 'image/png' : 'image/jpeg';
            return `data:${mime};base64,${buffer.toString('base64')}`;
          }
        }
      } catch (legacyError) {
        logger.warn('Legacy PDF photo lookup failed:', legacyError);
      }
    }

    // The protected document reader knows every historical storage layout
    // (application-number folders, CNIC folders, metadata records, and inline
    // legacy photos). Reuse it only for this explicit PDF request so list views
    // remain metadata-only and do not reintroduce photo egress.
    if (student.id) {
      try {
        const photo = await this.getStudentDocument(student.id, 'photo');
        if (photo.buffer.length > 0 && photo.contentType.startsWith('image/') && photo.contentType !== 'image/svg+xml') {
          return `data:${photo.contentType};base64,${photo.buffer.toString('base64')}`;
        }
      } catch (documentError) {
        logger.warn('Protected PDF photo lookup failed:', documentError);
      }

      // A verified private thumbnail is still the candidate's genuine photo.
      // Use it only if no original can be recovered for this one PDF.
      try {
        const thumbnail = await this.getStudentDocument(student.id, 'photoThumbnail');
        if (thumbnail.buffer.length > 0 && thumbnail.contentType.startsWith('image/') && thumbnail.contentType !== 'image/svg+xml') {
          return `data:${thumbnail.contentType};base64,${thumbnail.buffer.toString('base64')}`;
        }
      } catch (thumbnailError) {
        logger.warn('PDF thumbnail fallback lookup failed:', thumbnailError);
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

    const stableIdentifier = input.applicationNo || input.cnicOrBForm || input.studentId;
    if (!stableIdentifier || stableIdentifier === 'TEMP_CANDIDATE') {
      const error: AppError = new Error('A stable candidate identifier is required before upload.');
      error.statusCode = 400;
      throw error;
    }
    const rawApp = stableIdentifier.replace(/[^\w-]/g, '_');
    const ext = input.fileName?.split('.').pop() || (mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg');
    const bucket: StorageBucket = input.docType.startsWith('photo') ? 'student-photos' : 'student-documents';
    const pathName = `${rawApp}/${input.docType}.${ext.toLowerCase()}`;

    const encodedData = input.fileData.startsWith('data:')
      ? input.fileData.split(',')[1]
      : input.fileData;
    const buffer = Buffer.from(encodedData, 'base64');
    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1. Save locally to server uploads directory
    try {
      const candDir = path.join(UPLOADS_DIR, rawApp);
      if (!fs.existsSync(candDir)) {
        fs.mkdirSync(candDir, { recursive: true });
      }
      fs.writeFileSync(path.join(candDir, `${input.docType}.${ext}`), buffer);
    } catch (diskErr) {
      logger.warn('Disk storage save warning:', diskErr);
    }

    // 2. Upload to Supabase Storage if available
    await supabaseStorage.ensureBucketExists(bucket);
    const storageUpload = await supabaseStorage.uploadFile(
      bucket,
      pathName,
      buffer,
      mimeType
    );
    if (storageUpload.error) {
      const error: AppError = new Error('Private document storage upload failed. Please retry.');
      error.statusCode = 502;
      throw error;
    }

    // This URL is for a short-lived upload preview only and is never persisted.
    const publicUrl = await supabaseStorage.getSignedUrl(bucket, pathName, 15 * 60);

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
      bucket,
      supabasePath: pathName,
      mimeType,
      byteSize: buffer.length,
      checksumSha256,
      uploadedAt: new Date().toISOString(),
    };

    // If a candidate photo is uploaded, immediately generate and store 160x160 MozJPEG thumbnail
    if (input.docType.startsWith('photo') || input.docType === 'passportPhotos') {
      try {
        const thumbBuffer = await sharp(buffer)
          .resize(160, 160, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
        const thumbPath = `${rawApp}/photo_thumbnail.jpg`;
        await supabaseStorage.uploadFile('student-photos', thumbPath, thumbBuffer, 'image/jpeg');
        currentDocs.photoThumbnail = {
          name: 'photo_thumbnail.jpg',
          bucket: 'student-photos',
          supabasePath: thumbPath,
          mimeType: 'image/jpeg',
          byteSize: thumbBuffer.length,
          checksumSha256: crypto.createHash('sha256').update(thumbBuffer).digest('hex'),
          uploadedAt: new Date().toISOString(),
        };
      } catch (thumbErr) {
        logger.warn('Failed to auto-generate thumbnail during document upload:', thumbErr);
      }
    }

    if (student) {
      try {
        await prisma.student.update({
          where: { id: student.id },
          data: {
            uploadedDocsJson: JSON.stringify(currentDocs),
            ...(input.docType === 'photo' ? { photoUrl: null } : {}),
          },
        });
        await this.persistDocumentMetadata(student.id, currentDocs);
      } catch (err) {
        logger.warn('Failed to update student document in PostgreSQL:', err);
      }
    }

    return {
      success: true,
      bucket,
      path: pathName,
      publicUrl: publicUrl || undefined,
      mimeType,
      byteSize: buffer.length,
      checksumSha256,
      docType: input.docType,
      fileName: input.fileName || `${input.docType}.${ext}`,
    };
  }

  private getDocumentAliases(docType: string): string[] {
  const clean = docType.toLowerCase();
  if (clean === 'photo' || clean === 'passport' || clean === 'profile') {
    return ['photo', 'passportPhotos', 'passportPhoto', 'studentPhoto', 'photoUrl'];
  }
  if (clean === 'photothumbnail' || clean === 'thumbnail' || clean === 'photo_thumbnail') {
    return ['photoThumbnail', 'thumbnail', 'photo_thumbnail'];
  }
  if (clean === 'bform' || clean === 'cnic' || clean === 'bformcnic') {
    return ['bform', 'cnic', 'bformCnicCopy', 'bformUploaded', 'bform_copy', 'cnic_copy'];
  }
  if (clean === 'fathercnic' || clean === 'fcnic' || clean === 'guardiancnic') {
    return ['fatherCnic', 'fatherCnicCopy', 'fatherCnicUploaded', 'guardianCnic', 'fcnic'];
  }
  if (clean === 'dmc' || clean === 'resultcard' || clean === 'marksheet') {
    return ['dmc', 'previousResultCard', 'dmcUploaded', 'resultCard', 'marksheet', 'dmc_1', 'dmc_2'];
  }
  if (clean === 'paymentreceipt' || clean === 'challan' || clean === 'receipt' || clean === 'fee') {
    return ['paymentReceipt', 'challan', 'feeReceipt', 'receipt', 'depositSlip'];
  }
  if (clean === 'signature' || clean === 'applicantsignature') {
    return ['signature', 'applicantSignature', 'candidateSignature', 'digitalSignature'];
  }
  if (clean === 'domicile') {
    return ['domicile', 'domicileCertificate', 'domicileUploaded'];
  }
  if (clean === 'incomecertificate' || clean === 'income') {
    return ['incomeCertificate', 'incomeCertUploaded', 'incomeSlip'];
  }
  return [docType, `${docType}Uploaded`, `${docType}Copy`];
}

  private async fetchRemoteBuffer(url: string): Promise<Buffer | null> {
    // Student-controlled legacy values must never make the server request an
    // arbitrary URL. Documents are resolved only from private Storage, the
    // database metadata, or existing inline legacy data.
    logger.warn(`Skipping unsupported remote document URL: ${url.slice(0, 80)}`);
    return null;
  }

  /**
   * Retrieves a student's document or photo as a direct binary buffer for image streaming.
   */
  async getStudentDocument(studentIdentifier: string, docType: string): Promise<{ buffer: Buffer; contentType: string }> {
    const rawApp = studentIdentifier.replace(/[^\w-]/g, '_');
    const aliases = this.getDocumentAliases(docType);

    // 1. Check server disk storage first
    const candDir = path.join(UPLOADS_DIR, rawApp);
    const possibleExts = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
    for (const alias of aliases) {
      for (const ext of possibleExts) {
        const p = path.join(candDir, `${alias}.${ext}`);
        if (fs.existsSync(p)) {
          const buffer = fs.readFileSync(p);
          const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
          return { buffer, contentType: mime };
        }
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
      const metadata = await prisma.studentDocument.findFirst({
        where: {
          studentId: student.id,
          documentType: { in: aliases },
        },
      });
      if (metadata) {
        const buffer = await supabaseStorage.downloadFile(
          metadata.bucket as StorageBucket,
          metadata.objectPath
        );
        if (buffer && buffer.length > 0) return { buffer, contentType: metadata.mimeType };
      }
    }

    // 3. Check photoUrl if photo requested
    if (student && aliases.includes('photo') && student.photoUrl) {
      if (student.photoUrl.startsWith('data:')) {
        const match = student.photoUrl.match(/^data:(?:([^;]+))?;base64,(.*)$/s);
        if (match) {
          const mime = match[1] || 'image/jpeg';
          return { buffer: Buffer.from(match[2], 'base64'), contentType: mime };
        }
      } else if (student.photoUrl.startsWith('http')) {
        const buffer = await this.fetchRemoteBuffer(student.photoUrl);
        if (buffer && buffer.length > 0) {
          const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
          return { buffer, contentType: isPng ? 'image/png' : 'image/jpeg' };
        }
      }
    }

    // 5. Check uploadedDocsJson across all aliases
    if (student && student.uploadedDocsJson) {
      try {
        const docs = JSON.parse(student.uploadedDocsJson);
        for (const alias of aliases) {
          const doc = docs[alias];
          if (!doc) continue;

          // Object format with dataUrl
          if (doc.dataUrl && typeof doc.dataUrl === 'string' && doc.dataUrl.startsWith('data:')) {
            const match = doc.dataUrl.match(/^data:(?:([^;]+))?;base64,(.*)$/s);
            if (match) {
              const mime = match[1] || doc.fileType || doc.mimeType || 'image/jpeg';
              return { buffer: Buffer.from(match[2], 'base64'), contentType: mime };
            }
          }

          // String format dataUrl
          if (typeof doc === 'string' && doc.startsWith('data:')) {
            const match = doc.match(/^data:(?:([^;]+))?;base64,(.*)$/s);
            if (match) {
              const mime = match[1] || (doc.includes('application/pdf') ? 'application/pdf' : 'image/jpeg');
              return { buffer: Buffer.from(match[2], 'base64'), contentType: mime };
            }
          }

          // Object format with supabasePath
          if (doc.supabasePath) {
            const bucket: StorageBucket =
              doc.bucket || (docType.startsWith('photo') ? 'student-photos' : 'student-documents');
            const buf = await supabaseStorage.downloadFile(bucket, doc.supabasePath);
            if (buf && buf.length > 0) {
              const mime = doc.mimeType || (doc.supabasePath.endsWith('.pdf')
                ? 'application/pdf'
                : doc.supabasePath.endsWith('.png')
                ? 'image/png'
                : 'image/jpeg');
              return { buffer: buf, contentType: mime };
            }
          }

          // String format with supabasePath
          if (typeof doc === 'string' && !doc.startsWith('data:') && !doc.startsWith('http')) {
            const bucket: StorageBucket = docType.startsWith('photo') ? 'student-photos' : 'student-documents';
            const buf = await supabaseStorage.downloadFile(bucket, doc);
            if (buf && buf.length > 0) {
              const mime = doc.endsWith('.pdf') ? 'application/pdf' : doc.endsWith('.png') ? 'image/png' : 'image/jpeg';
              return { buffer: buf, contentType: mime };
            }
          }

          // Remote URL
          if (typeof doc === 'string' && doc.startsWith('http')) {
            const buf = await this.fetchRemoteBuffer(doc);
            if (buf && buf.length > 0) {
              const isPdf = doc.endsWith('.pdf') || buf.slice(0, 5).toString() === '%PDF-';
              const isPng = buf[0] === 0x89 && buf[1] === 0x50;
              return { buffer: buf, contentType: isPdf ? 'application/pdf' : isPng ? 'image/png' : 'image/jpeg' };
            }
          }
        }
      } catch (e) {}
    }

    // 6. Check Supabase Cloud Storage bucket directly under candidate folder
    if (student) {
      const bucket: StorageBucket = docType.startsWith('photo') ? 'student-photos' : 'student-documents';
      for (const prefix of [student.applicationNo, student.cnicOrBForm].filter(Boolean) as string[]) {
        const cleanPrefix = prefix.replace(/[^\w-]/g, '_');
        try {
          const { data: files } = (await (supabaseStorage as any).client?.storage?.from(bucket)?.list(cleanPrefix)) || { data: [] };
          const match = (files || []).find((f: any) => {
            const fname = f.name.toLowerCase();
            return aliases.some((a) => fname.includes(a.toLowerCase()));
          });
          if (match) {
            const storagePath = `${cleanPrefix}/${match.name}`;
            const buf = await supabaseStorage.downloadFile(bucket, storagePath);
            if (buf && buf.length > 0) {
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

    // Document truly not found
    const error: AppError = new Error(`Document "${docType}" not found for student "${studentIdentifier}".`);
    error.statusCode = 404;
    throw error;
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
