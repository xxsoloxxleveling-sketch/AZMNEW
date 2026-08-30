import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import { supabaseStorage, StorageBucket } from '../src/lib/supabaseStorage';

const apply = process.argv.includes('--apply');
// Legacy columns can contain full base64 files. Keep the index query tiny and
// process one student's payload at a time to avoid pooled-connection drops.
const batchSize = 10;

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
      },
    });
    if (students.length === 0) break;

    for (const indexedStudent of students) {
      const student = await prisma.student.findUnique({
        where: { id: indexedStudent.id },
        select: { id: true, cnicOrBForm: true, photoUrl: true, uploadedDocsJson: true },
      });
      if (!student) continue;
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
        if (documentType === 'photoThumbnail') continue;

        let existingPath =
          typeof document?.supabasePath === 'string'
            ? document.supabasePath
            : typeof document?.path === 'string'
            ? document.path
            : typeof document === 'string' && !document.startsWith('data:') && !document.startsWith('http')
            ? document
            : null;

        const embedded = parseDataUrl(
          document?.dataUrl ||
            (typeof document === 'string' && document.startsWith('data:') ? document : null) ||
            (documentType === 'photo' ? student.photoUrl : null)
        );

        const bucket: StorageBucket =
          document?.bucket || (documentType === 'photo' ? 'student-photos' : 'student-documents');

        // If no explicit path and no embedded data, check storage folder
        if (!existingPath && !embedded && student.cnicOrBForm) {
          const cleanPrefix = student.cnicOrBForm.replace(/[^\w-]/g, '_');
          try {
            const { data: files } = (await (supabaseStorage as any).client?.storage?.from(bucket)?.list(cleanPrefix)) || { data: [] };
            const match = (files || []).find((f: any) => f.name.toLowerCase().includes(documentType.toLowerCase()));
            if (match) {
              existingPath = `${cleanPrefix}/${match.name}`;
            }
          } catch {}
        }

        if (!existingPath && !embedded) continue;

        if (existingPath) metadataCandidates++;
        if (embedded && !existingPath) embeddedCandidates++;
        if (!apply) continue;

        const mimeType = document?.mimeType || embedded?.mimeType || (existingPath?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
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
        if (!downloaded) {
          console.warn(`Verification download skipped/failed for ${bucket}/${objectPath}`);
          continue;
        }
        const downloadedChecksum = crypto.createHash('sha256').update(downloaded).digest('hex');

        await prisma.studentDocument.upsert({
          where: { bucket_objectPath: { bucket, objectPath } },
          update: {
            studentId: student.id,
            documentType,
            originalFileName: document?.name || `${documentType}.${extensionFor(mimeType)}`,
            mimeType,
            byteSize: byteSize || downloaded.length,
            checksumSha256: downloadedChecksum,
          },
          create: {
            studentId: student.id,
            documentType,
            bucket,
            objectPath,
            originalFileName: document?.name || `${documentType}.${extensionFor(mimeType)}`,
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
