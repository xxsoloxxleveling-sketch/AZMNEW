import crypto from 'crypto';
import sharp from 'sharp';
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

// Render's free instance has a 512 MB ceiling. The job is already sequential;
// these limits also keep libvips from retaining decoded images between records.
sharp.concurrency(1);
sharp.cache({ memory: 8, files: 0, items: 8 });

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

async function makeThumbnail(photo: LegacyPhoto): Promise<Buffer> {
  // Sharp works in-process and avoids launching an additional Chrome browser,
  // keeping this one-time job within Render's free 512 MB memory limit.
  return sharp(photo.buffer, { limitInputPixels: 16_000_000 })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: 160, height: 160, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
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
        if (!apply) continue;

        try {
          const thumbnail = await makeThumbnail(legacyPhoto);
          const path = thumbnailPath(student.cnicOrBForm);
          const preexisting = await supabaseStorage.downloadFile(thumbnailBucket, path);
          if (!preexisting) {
            const upload = await supabaseStorage.uploadFile(thumbnailBucket, path, thumbnail, 'image/jpeg');
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
