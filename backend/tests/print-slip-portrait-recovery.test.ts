import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import dotenv from 'dotenv';
import sharp from 'sharp';

const backend = path.resolve(__dirname, '..');
let checks = 0;

async function check(name: string, fn: () => Promise<void>) {
  await fn(); checks++;
  console.log('PASS: ' + name);
}

async function run() {
  // Never run against production: create, use, and destroy only a unique
  // disposable database under an explicitly provided LOCAL Postgres server.
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing production tests.');
  dotenv.config({ path: path.join(backend, '..', '..', '..', 'backend', '.env'), quiet: true });
  const raw = process.env.PRINT_PORTRAIT_TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!raw) throw new Error('PRINT_PORTRAIT_TEST_DATABASE_URL must specify localhost PostgreSQL.');
  const source = new URL(raw);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
    throw new Error('Refusing nonlocal database host.');
  }
  const name = 'print_portrait_fixture_' + crypto.randomUUID().replace(/-/g, '');
  const fixtureUrl = new URL(source);
  fixtureUrl.pathname = '/' + name;
  fixtureUrl.searchParams.delete('schema');
  const env = {
    ...process.env, NODE_ENV: 'test',
    DATABASE_URL: fixtureUrl.toString(), DIRECT_URL: fixtureUrl.toString(),
    JWT_ACCESS_SECRET: 'synthetic-print-access-only',
    JWT_REFRESH_SECRET: 'synthetic-print-refresh-only',
    QR_SECRET: 'synthetic-print-qr-only',
  };
  for (const key of Object.keys(env)) if (key.startsWith('R2_') || key.startsWith('SUPABASE_')) env[key] = '';
  Object.assign(process.env, env);

  const admin = new Client({ connectionString: source.toString() });
  await admin.connect();
  let created = false;
  let db: any;
  let sharedPrisma: any;
  let originalDownload: unknown;
  let originalUpload: unknown;
  let storage: any;
  try {
    await admin.query('CREATE DATABASE "' + name + '"');
    created = true;
    execFileSync(process.execPath, [
      path.join(backend, 'node_modules', 'prisma', 'build', 'index.js'),
      'migrate', 'deploy', '--schema', path.join(backend, 'prisma', 'schema.prisma'),
    ], { cwd: backend, env, stdio: 'pipe', timeout: 90_000 });

    const [{ PrismaClient }, shared, { studentsService }, { pdfService }, r2] = await Promise.all([
      import('@prisma/client'),
      import('../src/lib/prisma'),
      import('../src/modules/students/students.service'),
      import('../src/modules/documents/pdf.service'),
      import('../src/lib/supabaseStorage'),
    ]);
    db = new PrismaClient();
    await db.$connect();
    sharedPrisma = shared.prisma;
    storage = r2.supabaseStorage;
    originalDownload = storage.downloadFile;
    originalUpload = storage.uploadFile;

    const makePng = async (r: number, g: number, b: number) =>
      sharp({ create: { width: 86, height: 108, channels: 3, background: { r, g, b } } }).png().toBuffer();
    const currentThumbnail = await makePng(30, 210, 40);
    const olderOriginal = await makePng(210, 40, 30);
    const legacyImage = await makePng(30, 40, 210);
    const blobs = new Map<string, Buffer>();
    const readKeys: string[] = [];
    let uploadAttempts = 0;
    storage.downloadFile = async (bucket: string, objectPath: string) => {
      const key = bucket + '/' + objectPath;
      readKeys.push(key);
      return blobs.get(key) ?? null;
    };
    storage.uploadFile = async () => {
      uploadAttempts++;
      throw new Error('Printing must never upload to R2.');
    };

    const createStudent = async (id: string) => db.student.create({
      data: {
        id, applicationNo: 'SYNTHETIC-' + id,
        qrToken: 'SYNTHETIC-QR-' + id,
        fullName: 'Synthetic Candidate', fatherName: 'Synthetic Parent',
        gender: 'FEMALE', dateOfBirth: new Date('2008-01-01'),
        cnicOrBForm: 'FAKE-IDENTITY-' + id,
        address: 'Fixture', district: 'Fixture', province: 'Fixture',
        parentMobile: '0000000000', currentClass: 'Class 10th',
        schoolName: 'Synthetic School', boardOrUniversity: 'Fixture',
        scholarshipCategory: 'GENERAL_MERIT', emergencyContact: '0000000000',
        emergencyRelation: 'Guardian',
      },
    });
    const student = await createStudent('print-candidate-1');
    const legacyStudent = await createStudent('print-candidate-2');
    const printableStudent = {
      ...student, rollNumber: 'SYNTHETIC-ROLL-001',
      placementStatus: 'ASSIGNED', assignedHallId: 'synthetic-hall',
      photoUrl: null, uploadedDocuments: undefined,
    };

    const createDoc = async (key: string, documentType: string, bucket: string, mimeType: string, updatedAt: string) =>
      db.studentDocument.create({
        data: {
          studentId: student.id, documentType, bucket, objectPath: key,
          originalFileName: key + '.png', mimeType, byteSize: currentThumbnail.length,
          updatedAt: new Date(updatedAt),
        },
      });
    await createDoc('print-test/old-original', 'photo', 'student-photos', 'image/png', '2026-09-01T00:00:00Z');
    await createDoc('print-test/newest-thumbnail', 'photoThumbnail', 'student-photos', 'image/png', '2026-10-01T00:00:00Z');
    blobs.set('student-photos/print-test/old-original', olderOriginal);
    blobs.set('student-photos/print-test/newest-thumbnail', currentThumbnail);

    async function assertColor(uri: string, expected: [number, number, number]) {
      assert.match(uri, /^data:image\/jpeg;base64,/);
      const jpg = Buffer.from(uri.substring(uri.indexOf(',') + 1), 'base64');
      const { data, info } = await sharp(jpg).resize(1, 1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.channels, 3);
      for (let i = 0; i < 3; i++) {
        assert(Math.abs(data[i] - expected[i]) < 15,
          'Incorrect portrait color in channel ' + i);
      }
    }

    let portrait = '';
    const preDocs = await db.studentDocument.count({ where: { studentId: student.id } });
    await check('Uses newest private thumbnail when formatted student omits photoUrl', async () => {
      readKeys.length = 0;
      portrait = await studentsService.resolveStudentPhotoBase64(printableStudent);
      await assertColor(portrait, [30, 210, 40]);
      assert.deepEqual(readKeys, ['student-photos/print-test/newest-thumbnail']);
    });
    await check('Single Roll Number Slip HTML embeds private image data without public image URL', async () => {
      const html = pdfService.generateRollSlipHtml(printableStudent, '', portrait);
      assert(html.includes(portrait));
      assert.match(html, /<img[^>]*src="data:image\/jpeg;base64,/);
    });
    await check('Single OMR sheet HTML embeds private image data without public image URL', async () => {
      const html = pdfService.generateOmrSheetHtml(printableStudent, '', portrait);
      assert(html.includes(portrait));
      assert.match(html, /<img[^>]*src="data:image\/jpeg;base64,/);
    });
    await check('Bulk Roll Slips preserve the same embedded real portrait', async () => {
      const html = pdfService.generateBulkRollSlipsHtml([{ student: printableStudent, qrDataUrl: '', photoBase64: portrait }]);
      assert(html.includes(portrait));
    });
    await check('Bulk OMR sheets preserve the same embedded real portrait', async () => {
      const html = pdfService.generateBulkOmrSheetsHtml([{ student: printableStudent, qrDataUrl: '', photoBase64: portrait }]);
      assert(html.includes(portrait));
    });
    await check('Missing newest thumbnail falls back to previous real original', async () => {
      blobs.delete('student-photos/print-test/newest-thumbnail');
      const value = await studentsService.resolveStudentPhotoBase64(printableStudent);
      await assertColor(value, [210, 40, 30]);
      blobs.set('student-photos/print-test/newest-thumbnail', currentThumbnail);
    });
    await check('Corrupt newest thumbnail falls back to previous real original', async () => {
      blobs.set('student-photos/print-test/newest-thumbnail', Buffer.from('<svg onload=alert(1)>'));
      const value = await studentsService.resolveStudentPhotoBase64(printableStudent);
      await assertColor(value, [210, 40, 30]);
      blobs.set('student-photos/print-test/newest-thumbnail', currentThumbnail);
    });
    await check('Unsafe bucket and SVG MIME are ignored without a storage request', async () => {
      await createDoc('print-test/unsafe', 'photoThumbnail', 'unsafe-public-bucket', 'image/png', '2026-10-03T00:00:00Z');
      await createDoc('print-test/svg', 'photoThumbnail', 'student-photos', 'image/svg+xml', '2026-10-04T00:00:00Z');
      readKeys.length = 0;
      const value = await studentsService.resolveStudentPhotoBase64(printableStudent);
      await assertColor(value, [30, 210, 40]);
      assert.deepEqual(readKeys, ['student-photos/print-test/newest-thumbnail']);
    });
    await check('Legacy inline photo still prints if no stored document exists', async () => {
      const value = await studentsService.resolveStudentPhotoBase64({
        ...legacyStudent, photoUrl: 'data:image/png;base64,' + legacyImage.toString('base64'),
      });
      await assertColor(value, [30, 40, 210]);
    });
    await check('No StudentDocument metadata, history or R2 bytes are modified by printing', async () => {
      assert.equal(await db.studentDocument.count({ where: { studentId: student.id } }), preDocs + 2);
      assert.equal(uploadAttempts, 0);
      const auditRows = await db.$queryRawUnsafe('SELECT count(*)::int AS n FROM "StudentDocumentAudit"');
      assert.equal(Number(auditRows[0]?.n), 0);
    });

    const rollHtml = pdfService.generateRollSlipHtml(printableStudent, '', portrait);
    const omrHtml = pdfService.generateOmrSheetHtml(printableStudent, '', portrait);
    await check('Chromium prints a real portrait image in the Roll Slip PDF', async () => {
      const pdf = await pdfService.generatePdfFromHtml(rollHtml);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert(pdf.length > 10000);
      assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image/);
    });
    await check('Chromium prints a real portrait image in the OMR sheet PDF', async () => {
      const pdf = await pdfService.generatePdfFromHtml(omrHtml);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert(pdf.length > 10000);
      assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image/);
    });
    console.log('PRINT_PORTRAIT_TEST_PASS=' + checks + ' FAIL=0');
  } finally {
    if (storage && originalDownload) storage.downloadFile = originalDownload;
    if (storage && originalUpload) storage.uploadFile = originalUpload;
    if (db) await db.$disconnect();
    if (sharedPrisma) await sharedPrisma.$disconnect();
    if (created) {
      try {
        await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)');
        console.log('DISPOSABLE_DB_DROPPED=' + name);
      } catch (error) {
        console.error('LOCAL_DISPOSABLE_DB_CLEANUP_REQUIRED=' + name);
        throw error;
      }
    }
    await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
