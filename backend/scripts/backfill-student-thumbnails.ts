import crypto from 'crypto';
import puppeteer, { Browser, Page } from 'puppeteer';
import { prisma } from '../src/lib/prisma';
import { supabaseStorage } from '../src/lib/supabaseStorage';

/**
 * Creates small private profile thumbnails for legacy students.
 *
 * This is intentionally additive: it never changes Student.photoUrl, uploadedDocsJson,
 * or an existing photo/photoThumbnail file. Run without --apply first to preview.
 */
const batchSize = 25;
const thumbnailBucket = 'student-photos' as const;

export type ThumbnailBackfillSummary = {
  mode: 'apply-with-verification' | 'dry-run';
  scanned: number;
  alreadyPresent: number;
  candidates: number;
  created: number;
  skipped: number;
  failed: number;
  legacyDataChanged: false;
};

type LegacyPhoto = {
  buffer: Buffer;
  mimeType: string;
  originalFileName?: string | null;
};

function dataUrlToPhoto(value: unknown): LegacyPhoto | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.*)$/s);
  if (!match) return null;
  return {
    mimeType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function thumbnailPath(cnicOrBForm: string) {
  return `${cnicOrBForm.replace(/[^\w-]/g, '_')}/photo_thumbnail.jpg`;
}

async function makeThumbnail(page: Page, photo: LegacyPhoto) {
  const source = `data:${photo.mimeType};base64,${photo.buffer.toString('base64')}`;
  return page.evaluate(async (dataUrl) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The source file is not a readable image'));
      element.src = dataUrl;
    });

    const maxDimension = 160;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }, source);
}

async function getLegacyPhoto(student: any): Promise<LegacyPhoto | null> {
  const documents = student.uploadedDocsJson ? JSON.parse(student.uploadedDocsJson) : {};
  const inline = dataUrlToPhoto(student.photoUrl) || dataUrlToPhoto(documents?.photo?.dataUrl);
  if (inline) return { ...inline, originalFileName: documents?.photo?.name };

  const photoMetadata = student.studentDocuments.find((document: any) => document.documentType === 'photo');
  const sourceBucket = photoMetadata?.bucket || documents?.photo?.bucket;
  const sourcePath = photoMetadata?.objectPath || documents?.photo?.supabasePath;
  if (!sourceBucket || !sourcePath) return null;
  const buffer = await supabaseStorage.downloadFile(sourceBucket, sourcePath);
  if (!buffer) return null;
  const mimeType = photoMetadata?.mimeType || documents?.photo?.mimeType || 'image/jpeg';
  if (!/^image\/(jpeg|jpg|png|webp)$/.test(mimeType)) return null;
  return { buffer, mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType, originalFileName: photoMetadata?.originalFileName || documents?.photo?.name };
}

export async function runThumbnailBackfill(options: { apply: boolean; disconnectDatabase?: boolean }): Promise<ThumbnailBackfillSummary> {
  const { apply, disconnectDatabase = false } = options;
  let cursor: string | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  const summary: Omit<ThumbnailBackfillSummary, 'legacyDataChanged'> = {
    mode: apply ? 'apply-with-verification' : 'dry-run',
    scanned: 0,
    alreadyPresent: 0,
    candidates: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    if (apply) {
      browser = await puppeteer.launch({ headless: true });
      page = await browser.newPage();
    }

    do {
      const students = await prisma.student.findMany({
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          cnicOrBForm: true,
          photoUrl: true,
          uploadedDocsJson: true,
          studentDocuments: { select: { documentType: true, bucket: true, objectPath: true, mimeType: true, originalFileName: true } },
        },
      });
      if (!students.length) break;

      for (const student of students) {
        summary.scanned++;
        if (student.studentDocuments.some((document) => document.documentType === 'photoThumbnail')) {
          summary.alreadyPresent++;
          continue;
        }
        let legacyPhoto: LegacyPhoto | null = null;
        try {
          legacyPhoto = await getLegacyPhoto(student);
        } catch {
          summary.failed++;
          continue;
        }
        if (!legacyPhoto) {
          summary.skipped++;
          continue;
        }
        summary.candidates++;
        if (!apply || !page) continue;

        try {
          const dataUrl = await makeThumbnail(page, legacyPhoto);
          const thumbnail = dataUrlToPhoto(dataUrl);
          if (!thumbnail) throw new Error('Thumbnail encoding failed');
          const path = thumbnailPath(student.cnicOrBForm);
          const preexisting = await supabaseStorage.downloadFile(thumbnailBucket, path);
          if (!preexisting) {
            const upload = await supabaseStorage.uploadFile(thumbnailBucket, path, thumbnail.buffer, 'image/jpeg');
            if (upload.error) throw new Error(upload.error);
          }
          const verified = await supabaseStorage.downloadFile(thumbnailBucket, path);
          if (!verified) throw new Error('Verification download failed');
          const checksumSha256 = crypto.createHash('sha256').update(verified).digest('hex');
          await prisma.studentDocument.upsert({
            where: { bucket_objectPath: { bucket: thumbnailBucket, objectPath: path } },
            update: { studentId: student.id, documentType: 'photoThumbnail', originalFileName: legacyPhoto.originalFileName || 'Candidate_Photo_Thumbnail.jpg', mimeType: 'image/jpeg', byteSize: verified.length, checksumSha256 },
            create: { studentId: student.id, documentType: 'photoThumbnail', bucket: thumbnailBucket, objectPath: path, originalFileName: legacyPhoto.originalFileName || 'Candidate_Photo_Thumbnail.jpg', mimeType: 'image/jpeg', byteSize: verified.length, checksumSha256 },
          });
          summary.created++;
        } catch (error) {
          summary.failed++;
          console.error(`Thumbnail failed for ${student.id}:`, error instanceof Error ? error.message : error);
        }
      }
      cursor = students.at(-1)?.id;
      if (students.length < batchSize) break;
    } while (cursor);
  } finally {
    await browser?.close();
    if (disconnectDatabase) await prisma.$disconnect();
  }
  return { ...summary, legacyDataChanged: false };
}

if (require.main === module) {
  runThumbnailBackfill({ apply: process.argv.includes('--apply'), disconnectDatabase: true })
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      if (summary.failed) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
