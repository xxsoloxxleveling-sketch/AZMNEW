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
  const match = value.match(/^data:(?:image\/(?:jpeg|jpg|png|webp)|application\/octet-stream)?;base64,(.*)$/s);
  if (match) {
    const buffer = Buffer.from(match[1], 'base64');
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
    return {
      mimeType: isPng ? 'image/png' : 'image/jpeg',
      buffer,
    };
  }
  return null;
}

function thumbnailPath(cnicOrBForm: string) {
  return `${cnicOrBForm.replace(/[^\w-]/g, '_')}/photo_thumbnail.jpg`;
}

async function fetchRemoteImage(url: string): Promise<Buffer | null> {
  // Never fetch a URL stored in a legacy student record: it could target an
  // internal service or download an unbounded file. Backfills use the verified
  // private Storage object, embedded legacy data, or skip the record safely.
  void url;
  return null;
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
  let documents: Record<string, any> = {};
  if (student.uploadedDocsJson) {
    try {
      documents = JSON.parse(student.uploadedDocsJson);
    } catch {}
  }

  const photoDoc =
    documents?.photo ||
    documents?.photoUploaded ||
    documents?.passportPhoto ||
    documents?.candidatePhoto ||
    documents?.profilePhoto ||
    documents?.picture;

  // 1. Check inline base64
  const inline =
    dataUrlToPhoto(student.photoUrl) ||
    dataUrlToPhoto(photoDoc?.dataUrl) ||
    (typeof photoDoc === 'string' ? dataUrlToPhoto(photoDoc) : null);
  if (inline) return { ...inline, originalFileName: photoDoc?.name || photoDoc?.originalFileName || 'Candidate_Photo.jpg' };

  // 2. Check remote URL in photoUrl
  if (typeof student.photoUrl === 'string' && student.photoUrl.startsWith('http')) {
    const buffer = await fetchRemoteImage(student.photoUrl);
    if (buffer && buffer.length > 0) {
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
      return {
        buffer,
        mimeType: isPng ? 'image/png' : 'image/jpeg',
        originalFileName: 'Candidate_Photo.jpg',
      };
    }
  }

  // 3. Check studentDocuments table
  const photoMetadata = (student.studentDocuments || []).find((d: any) =>
    ['photo', 'candidatePhoto', 'passportPhoto'].includes(d.documentType)
  );
  const sourceBucket = (photoMetadata?.bucket || photoDoc?.bucket || 'student-photos') as any;
  const sourcePath =
    photoMetadata?.objectPath ||
    photoDoc?.supabasePath ||
    photoDoc?.path ||
    (typeof photoDoc === 'string' && !photoDoc.startsWith('data:') ? photoDoc : null);

  if (sourceBucket && sourcePath) {
    const buffer = await supabaseStorage.downloadFile(sourceBucket, sourcePath);
    if (buffer && buffer.length > 0) {
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
      const mimeType = photoMetadata?.mimeType || photoDoc?.mimeType || (isPng ? 'image/png' : 'image/jpeg');
      return {
        buffer,
        mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
        originalFileName: photoMetadata?.originalFileName || photoDoc?.name || 'Candidate_Photo.jpg',
      };
    }
  }

  // 4. Supabase Storage listing by candidate CNIC or Application Number
  for (const prefix of [student.cnicOrBForm, student.applicationNo].filter(Boolean) as string[]) {
    const cleanPrefix = prefix.replace(/[^\w-]/g, '_');
    try {
      const { data: files } = (await (supabaseStorage as any).client?.storage
        ?.from('student-photos')
        ?.list(cleanPrefix)) || { data: [] };
      const match = (files || []).find(
        (f: any) =>
          !f.name.includes('thumbnail') &&
          (f.name.startsWith('photo') || f.name.startsWith('passport') || /\.(jpg|jpeg|png|webp)$/i.test(f.name))
      );
      if (match) {
        const storagePath = `${cleanPrefix}/${match.name}`;
        const buffer = await supabaseStorage.downloadFile('student-photos', storagePath);
        if (buffer && buffer.length > 0) {
          const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
          return {
            buffer,
            mimeType: isPng ? 'image/png' : 'image/jpeg',
            originalFileName: match.name,
          };
        }
      }
    } catch {}
  }

  return null;
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
      // Do not select legacy photoUrl/uploadedDocsJson here. Those columns can
      // contain full base64 images; fetching 25 of them in one result made this
      // query take ~20 seconds and could drop a pooled connection. Read the
      // small index first, then fetch a single candidate's legacy payload only
      // when we actually need to make its thumbnail.
      const students = await prisma.student.findMany({
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          cnicOrBForm: true,
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
          const studentWithPhoto = await prisma.student.findUnique({
            where: { id: student.id },
            select: {
              id: true,
              cnicOrBForm: true,
              photoUrl: true,
              uploadedDocsJson: true,
              studentDocuments: { select: { documentType: true, bucket: true, objectPath: true, mimeType: true, originalFileName: true } },
            },
          });
          legacyPhoto = studentWithPhoto ? await getLegacyPhoto(studentWithPhoto) : null;
        } catch {
          summary.failed++;
          continue;
        }
        if (!legacyPhoto) {
          summary.skipped++;
          continue;
        }
        summary.candidates++;
        if (!apply) {
          console.log(`[PREVIEW] Found photo candidate for student ${student.id} (${student.cnicOrBForm})`);
          continue;
        }

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
          console.log(`[CREATED] Thumbnail generated and saved for student ${student.id} (${student.cnicOrBForm}) -> ${path}`);
        } catch (error) {
          summary.failed++;
          console.error(`Thumbnail failed for ${student.id}:`, error instanceof Error ? error.message : error);
        }
      }
      console.log(`[PROGRESS] Scanned: ${summary.scanned}, Existing: ${summary.alreadyPresent}, Candidates: ${summary.candidates}, Created: ${summary.created}, Skipped: ${summary.skipped}`);
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
