import crypto from 'node:crypto';
import sharp from 'sharp';
import { DocumentReviewStatus, Prisma, StudentDocument, StudentDocumentAuditAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { supabaseStorage } from '../../lib/supabaseStorage';
import type { StorageBucket } from '../../lib/supabaseStorage';
import { logger } from '../../lib/logger';
import {
  VaultListQuery, VaultHistoryQuery, VaultReviewInput,
  validateVaultFile, safeVaultFileName,
} from './vault.schema';

export interface VaultActor { id: string; name: string }

function fail(code: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode: code });
}

function publicDocument(doc: StudentDocument & { student?: { fullName: string; applicationNo: string; rollNumber: string | null; currentClass: string } }) {
  return {
    id: doc.id,
    studentId: doc.studentId,
    studentName: doc.student?.fullName,
    applicationNo: doc.student?.applicationNo,
    rollNumber: doc.student?.rollNumber,
    currentClass: doc.student?.currentClass,
    documentType: doc.documentType,
    originalFileName: doc.originalFileName || doc.documentType,
    mimeType: doc.mimeType,
    byteSize: doc.byteSize,
    reviewStatus: doc.reviewStatus,
    rejectionReason: doc.rejectionReason,
    reviewedAt: doc.reviewedAt,
    reviewedByName: doc.reviewedByName,
    revision: doc.revision,
    uploadedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    fileEndpoint: '/api/vault/documents/' + encodeURIComponent(doc.id) + '/file',
  };
}

const studentSelect = {
  fullName: true, applicationNo: true, rollNumber: true, currentClass: true,
} as const;

function reviewBaseQuery(query: VaultListQuery): Prisma.StudentDocumentWhereInput {
  const where: Prisma.StudentDocumentWhereInput = { documentType: { not: 'photoThumbnail' } };
  if (query.studentId) where.studentId = query.studentId;
  if (query.type) where.documentType = query.type === 'dmc' ? { startsWith: 'dmc' } : query.type;
  if (query.class) where.student = { is: { currentClass: { equals: query.class, mode: 'insensitive' } } };
  if (query.search) {
    const search = query.search;
    where.OR = [
      { originalFileName: { contains: search, mode: 'insensitive' } },
      { student: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
      { student: { is: { applicationNo: { contains: search, mode: 'insensitive' } } } },
      { student: { is: { rollNumber: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  return where;
}

type StoredBytes = { bucket: StorageBucket; objectPath: string; mimeType: string; filename: string; checksumSha256: string; byteSize: number };
type ReconciliationObject = { bucket: StorageBucket; objectPath: string; objectKey: string; uploadState: 'attempted' | 'uploaded' };

// Register the complete R2 key before calling storage: a rejected upload can
// still have committed remotely before its acknowledgement was lost.
async function uploadTrackedObject(objects: ReconciliationObject[], bucket: StorageBucket, objectPath: string, buffer: Buffer, mime: string, failureMessage: string): Promise<void> {
  const object: ReconciliationObject = { bucket, objectPath, objectKey: `${bucket}/${objectPath}`, uploadState: 'attempted' };
  objects.push(object);
  const result = await supabaseStorage.uploadFile(bucket, objectPath, buffer, mime);
  if (result.error) fail(502, failureMessage);
  object.uploadState = 'uploaded';
}

function reconcileFailure(operation: 'upload' | 'replace', objects: ReconciliationObject[], error: unknown): never {
  try {
    if (objects.length) {
      // One JSON record preserves every attempted key in the existing server
      // log, including originals and thumbnails. Reconciliation never deletes.
      logger.error('Vault operation failed; private objects require orphan reconciliation:', JSON.stringify({ operation, objects }));
    }
  } finally {
    // Logging must not replace the original storage/thumbnail/database error.
    throw error;
  }
}

async function putPrivateObject(studentId: string, documentType: string, filename: string, buffer: Buffer, mime: string, ext: string, objects: ReconciliationObject[]): Promise<StoredBytes> {
  if (!supabaseStorage.configured) fail(503, 'Private R2 document storage is unavailable.');
  const bucket: StorageBucket = documentType === 'photo' ? 'student-photos' : 'student-documents';
  const objectPath = 'vault/' + studentId + '/' + documentType + '/' + crypto.randomUUID() + '.' + ext;
  await uploadTrackedObject(objects, bucket, objectPath, buffer, mime, 'Failed to save the document to private storage.');
  return {
    bucket, objectPath, mimeType: mime, filename, byteSize: buffer.length,
    checksumSha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

async function storeThumbnail(studentId: string, buffer: Buffer, objects: ReconciliationObject[]): Promise<StoredBytes> {
  const bytes = await sharp(buffer).resize(160, 160, { fit: 'cover', position: 'center' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const objectPath = 'vault/' + studentId + '/photoThumbnail/' + crypto.randomUUID() + '.jpg';
  await uploadTrackedObject(objects, 'student-photos', objectPath, bytes, 'image/jpeg', 'Failed to store the derived private photo thumbnail.');
  return {
    bucket: 'student-photos', objectPath, mimeType: 'image/jpeg', filename: 'photo_thumbnail.jpg',
    checksumSha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteSize: bytes.length,
  };
}

// Reject corrupt, mismatched or pathological images before writing R2 objects.
async function checkImageDecode(bytes: Buffer, mime: string): Promise<void> {
  if (mime === 'application/pdf') return;
  try {
    const result = await sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'error' }).metadata();
    const format = mime === 'image/png' ? 'png' : 'jpeg';
    if (result.format !== format || !result.width || !result.height || result.width * result.height > 20_000_000) {
      fail(400, 'Invalid or oversized image dimensions.');
    }
  } catch {
    fail(400, 'The image cannot be decoded safely.');
  }
}

const storedData = (file: StoredBytes) => ({
  bucket: file.bucket, objectPath: file.objectPath, mimeType: file.mimeType,
  originalFileName: file.filename, checksumSha256: file.checksumSha256, byteSize: file.byteSize,
});

export const vaultService = {
  async list(query: VaultListQuery) {
    const base = reviewBaseQuery(query);
    const where = { ...base, ...(query.status ? { reviewStatus: query.status } : {}) } as Prisma.StudentDocumentWhereInput;
    const [documents, total, stats, classGroups] = await Promise.all([
      prisma.studentDocument.findMany({
        where, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: { student: { select: studentSelect } },
      }),
      prisma.studentDocument.count({ where }),
      prisma.studentDocument.groupBy({ by: ['reviewStatus'], where: base, _count: { _all: true } }),
      prisma.student.groupBy({ by: ['currentClass'], orderBy: { currentClass: 'asc' } }),
    ]);
    const counts = { PENDING_REVIEW: 0, VERIFIED: 0, REJECTED: 0 };
    for (const item of stats) counts[item.reviewStatus] = item._count._all;
    return {
      documents: documents.map(publicDocument),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
      summary: { total: counts.PENDING_REVIEW + counts.VERIFIED + counts.REJECTED, ...counts },
      classes: classGroups.map(item => item.currentClass),
    };
  },

  async get(id: string) {
    const document = await prisma.studentDocument.findUnique({ where: { id }, include: { student: { select: studentSelect } } });
    if (!document || document.documentType === 'photoThumbnail') fail(404, 'Document not found.');
    return publicDocument(document);
  },

  async file(id: string) {
    const document = await prisma.studentDocument.findUnique({ where: { id } });
    if (!document || document.documentType === 'photoThumbnail') fail(404, 'Document not found.');
    return this.getStoredFile(document.bucket, document.objectPath, document.mimeType, document.originalFileName || document.documentType);
  },

  async getStoredFile(bucket: string, objectPath: string, mimeType: string, filename: string) {
    if (!['student-photos', 'student-documents'].includes(bucket)) fail(404, 'Document storage reference is unavailable.');
    const buffer = await supabaseStorage.downloadFile(bucket as StorageBucket, objectPath);
    if (!buffer || !buffer.length) fail(404, 'The original private file is unavailable. Metadata has been preserved.');
    // Never serve arbitrary HTML/SVG or externally supplied content as active pages.
    const safeMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)
      ? mimeType : 'application/octet-stream';
    return { buffer, mimeType: safeMime, filename: filename.replace(/[\\/\r\n"<>]/g, '_').slice(0, 160) || 'document' };
  },

  async history(id: string, query: VaultHistoryQuery) {
    await this.get(id);
    const [events, total] = await Promise.all([
      prisma.studentDocumentAudit.findMany({
        where: { documentId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit, take: query.limit,
      }),
      prisma.studentDocumentAudit.count({ where: { documentId: id } }),
    ]);
    return {
      events: events.map(event => ({
        id: event.id, documentId: event.documentId,
        action: event.action, actorName: event.actorName, createdAt: event.createdAt,
        fromStatus: event.fromStatus, toStatus: event.toStatus, reason: event.reason,
        previousFileName: event.previousFileName,
        newFileName: event.newFileName,
        priorVersionAvailable: event.action === 'REPLACED' && Boolean(event.previousObjectPath),
      })),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  },

  async historyFile(id: string, eventId: string) {
    await this.get(id);
    const event = await prisma.studentDocumentAudit.findFirst({ where: { id: eventId, documentId: id, action: 'REPLACED' } });
    if (!event?.previousObjectPath || !event.previousBucket) fail(404, 'Historical file is unavailable.');
    return this.getStoredFile(event.previousBucket, event.previousObjectPath, event.previousMimeType || 'application/octet-stream', event.previousFileName || 'previous-version');
  },

  async upload(input: { studentId: string; documentType: string; filename: string; mimeType: string; buffer: Buffer }, actor: VaultActor) {
    const { mime, extension } = validateVaultFile(input.buffer, input.mimeType, input.documentType);
    await checkImageDecode(input.buffer, mime);
    const filename = safeVaultFileName(input.filename);
    const student = await prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true } });
    if (!student) fail(404, 'Student not found.');
    const objects: ReconciliationObject[] = [];
    try {
      const file = await putPrivateObject(student.id, input.documentType, filename, input.buffer, mime, extension, objects);
      const thumbnail = input.documentType === 'photo' ? await storeThumbnail(student.id, input.buffer, objects) : null;
      return await prisma.$transaction(async (tx) => {
        const document = await tx.studentDocument.create({
          data: { studentId: student.id, documentType: input.documentType, ...storedData(file), uploadedById: actor.id },
        });
        if (thumbnail) {
          await tx.studentDocument.create({ data: { studentId: student.id, documentType: 'photoThumbnail', ...storedData(thumbnail), uploadedById: actor.id } });
        }
        await tx.studentDocumentAudit.create({
          data: {
            documentId: document.id, studentId: student.id, actorId: actor.id, actorName: actor.name,
            action: 'UPLOADED', toStatus: 'PENDING_REVIEW',
            newObjectPath: file.objectPath, newBucket: file.bucket, newFileName: file.filename,
            newMimeType: file.mimeType, newSha256: file.checksumSha256,
          },
        });
        return publicDocument(document);
      }, { maxWait: 10000, timeout: 20000 });
    } catch (error) {
      reconcileFailure('upload', objects, error);
    }
  },

  async replace(id: string, expectedRevision: number, input: { filename: string; mimeType: string; buffer: Buffer }, actor: VaultActor) {
    const old = await prisma.studentDocument.findUnique({ where: { id } });
    if (!old || old.documentType === 'photoThumbnail') fail(404, 'Document not found.');
    if (old.revision !== expectedRevision) fail(409, 'Document changed. Refresh before replacing.');
    const { mime, extension } = validateVaultFile(input.buffer, input.mimeType, old.documentType);
    await checkImageDecode(input.buffer, mime);
    const filename = safeVaultFileName(input.filename);
    const objects: ReconciliationObject[] = [];
    try {
      const file = await putPrivateObject(old.studentId, old.documentType, filename, input.buffer, mime, extension, objects);
      const thumbnail = old.documentType === 'photo' ? await storeThumbnail(old.studentId, input.buffer, objects) : null;
      return await prisma.$transaction(async tx => {
        const result = await tx.studentDocument.updateMany({
          where: { id, revision: expectedRevision },
          data: { ...storedData(file), revision: { increment: 1 }, reviewStatus: 'PENDING_REVIEW', reviewedAt: null, reviewedById: null, reviewedByName: null, rejectionReason: null, uploadedById: actor.id },
        });
        if (result.count !== 1) fail(409, 'Document changed during replacement. Refresh and retry.');
        if (thumbnail) {
          const existing = await tx.studentDocument.findFirst({
            where: { studentId: old.studentId, documentType: 'photoThumbnail' },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          });
          if (existing) {
            await tx.studentDocument.update({
              where: { id: existing.id }, data: { ...storedData(thumbnail), revision: { increment: 1 }, uploadedById: actor.id },
            });
          } else {
            await tx.studentDocument.create({
              data: { studentId: old.studentId, documentType: 'photoThumbnail', ...storedData(thumbnail), uploadedById: actor.id },
            });
          }
        }
        await tx.studentDocumentAudit.create({
          data: {
            documentId: id, studentId: old.studentId, actorId: actor.id, actorName: actor.name,
            action: 'REPLACED', fromStatus: old.reviewStatus, toStatus: 'PENDING_REVIEW',
            previousObjectPath: old.objectPath, previousBucket: old.bucket,
            previousFileName: old.originalFileName, previousMimeType: old.mimeType, previousSha256: old.checksumSha256,
            newObjectPath: file.objectPath, newBucket: file.bucket, newFileName: file.filename,
            newMimeType: file.mimeType, newSha256: file.checksumSha256,
          },
        });
        const updated = await tx.studentDocument.findUniqueOrThrow({ where: { id } });
        return publicDocument(updated);
      }, { maxWait: 10000, timeout: 20000 });
    } catch (error) {
      reconcileFailure('replace', objects, error);
    }
  },

  async review(id: string, input: VaultReviewInput, actor: VaultActor) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.studentDocument.findUnique({ where: { id } });
      if (!current || current.documentType === 'photoThumbnail') fail(404, 'Document not found.');
      if (current.revision !== input.expectedRevision) fail(409, 'Document changed. Refresh before reviewing.');
      const status = input.status as DocumentReviewStatus;
      if (current.reviewStatus === status && (current.rejectionReason || '') === (input.reason || '')) {
        fail(409, 'This document is already in the requested review state.');
      }
      const updated = await tx.studentDocument.updateMany({
        where: { id, revision: input.expectedRevision },
        data: {
          reviewStatus: status, reviewedAt: status === 'PENDING_REVIEW' ? null : new Date(),
          reviewedById: status === 'PENDING_REVIEW' ? null : actor.id,
          reviewedByName: status === 'PENDING_REVIEW' ? null : actor.name,
          rejectionReason: status === 'REJECTED' ? input.reason : null,
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) fail(409, 'Document changed during review. Refresh and retry.');
      const action: StudentDocumentAuditAction = status === 'VERIFIED' ? 'VERIFIED' : status === 'REJECTED' ? 'REJECTED' : 'REOPENED';
      await tx.studentDocumentAudit.create({
        data: { documentId: id, studentId: current.studentId, actorId: actor.id, actorName: actor.name,
          action, fromStatus: current.reviewStatus, toStatus: status, reason: input.reason || null },
      });
      return publicDocument(await tx.studentDocument.findUniqueOrThrow({ where: { id } }));
    }, { maxWait: 10000, timeout: 20000 });
  },
};
