import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import { supabaseStorage, StorageBucket } from '../src/lib/supabaseStorage';

const apply = process.argv.includes('--apply');
const batchSize = 50;

const parseDataUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  return {
    mimeType: match[1],
    buffer,
    checksumSha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
};

const extensionFor = (mimeType: string) =>
  mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';

async function run() {
  let cursor: string | undefined;
  let scanned = 0;
  let metadataCandidates = 0;
  let embeddedCandidates = 0;
  let verified = 0;

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
      },
    });
    if (students.length === 0) break;

    for (const student of students) {
      scanned++;
      const documents: Record<string, any> = {};
      if (student.uploadedDocsJson) {
        try {
          Object.assign(documents, JSON.parse(student.uploadedDocsJson));
        } catch {}
      }
      if (student.photoUrl && !documents.photo) {
        documents.photo = { dataUrl: student.photoUrl, name: 'Candidate photo' };
      }

      for (const [documentType, document] of Object.entries(documents)) {
        const existingPath = typeof document?.supabasePath === 'string' ? document.supabasePath : null;
        const embedded = parseDataUrl(document?.dataUrl || (documentType === 'photo' ? student.photoUrl : null));
        if (!existingPath && !embedded) continue;

        if (existingPath) metadataCandidates++;
        if (embedded && !existingPath) embeddedCandidates++;
        if (!apply) continue;

        const bucket: StorageBucket =
          document?.bucket || (documentType === 'photo' ? 'student-photos' : 'student-documents');
        const mimeType = document?.mimeType || embedded?.mimeType || 'application/octet-stream';
        const objectPath =
          existingPath ||
          `${student.cnicOrBForm.replace(/[^\w-]/g, '_')}/${documentType}.${extensionFor(mimeType)}`;

        let checksumSha256 = document?.checksumSha256 as string | undefined;
        let byteSize = Number(document?.byteSize) || undefined;
        if (!existingPath && embedded) {
          const upload = await supabaseStorage.uploadFile(bucket, objectPath, embedded.buffer, mimeType);
          if (upload.error) throw new Error(`Upload failed for ${student.id}/${documentType}: ${upload.error}`);
          checksumSha256 = embedded.checksumSha256;
          byteSize = embedded.buffer.length;
        }

        const downloaded = await supabaseStorage.downloadFile(bucket, objectPath);
        if (!downloaded) throw new Error(`Verification download failed for ${bucket}/${objectPath}`);
        const downloadedChecksum = crypto.createHash('sha256').update(downloaded).digest('hex');
        if (checksumSha256 && downloadedChecksum !== checksumSha256) {
          throw new Error(`Checksum mismatch for ${bucket}/${objectPath}`);
        }

        await prisma.studentDocument.upsert({
          where: { bucket_objectPath: { bucket, objectPath } },
          update: {
            studentId: student.id,
            documentType,
            originalFileName: document?.name,
            mimeType,
            byteSize: byteSize || downloaded.length,
            checksumSha256: downloadedChecksum,
          },
          create: {
            studentId: student.id,
            documentType,
            bucket,
            objectPath,
            originalFileName: document?.name,
            mimeType,
            byteSize: byteSize || downloaded.length,
            checksumSha256: downloadedChecksum,
          },
        });
        verified++;
      }
    }

    cursor = students.at(-1)?.id;
    if (students.length < batchSize) break;
  } while (cursor);

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply-with-verification' : 'dry-run',
        scannedStudents: scanned,
        existingObjectPaths: metadataCandidates,
        embeddedFilesNeedingUpload: embeddedCandidates,
        verifiedAndRecorded: verified,
        legacyDataChanged: false,
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
