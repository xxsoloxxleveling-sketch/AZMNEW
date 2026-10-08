import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import dotenv from 'dotenv';
import sharp from 'sharp';

const backend = path.resolve(__dirname, '..');

function checkFileRules() {
  const { validateVaultFile, safeVaultFileName, vaultReviewSchema, vaultListSchema } = require('../src/modules/vault/vault.schema');
  let checks = 0;
  const check = (name: string, run: () => void) => { run(); checks++; console.log('PASS: ' + name); };
  const jpeg = Buffer.from([255, 216, 255, 217]);
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  const pdf = Buffer.from('%PDF-1.7\n% synthetic PDF test');
  check('valid JPEG signatures accepted', () => assert.equal(validateVaultFile(jpeg, 'image/jpeg', 'photo').mime, 'image/jpeg'));
  check('valid PNG signatures accepted', () => assert.equal(validateVaultFile(png, 'image/png', 'photo').mime, 'image/png'));
  check('valid PDF signature accepted for DMC', () => assert.equal(validateVaultFile(pdf, 'application/pdf', 'dmc').mime, 'application/pdf'));
  check('mismatched MIME rejected', () => assert.throws(() => validateVaultFile(jpeg, 'application/pdf', 'bform'), /content does not match/i));
  check('HTML disallowed', () => assert.throws(() => validateVaultFile(Buffer.from('<script>'), 'text/html', 'bform'), /JPEG, PNG and PDF/i));
  check('photo cannot be PDF', () => assert.throws(() => validateVaultFile(pdf, 'application/pdf', 'photo'), /photographs/i));
  check('empty files rejected', () => assert.throws(() => validateVaultFile(Buffer.alloc(0), 'image/jpeg', 'photo'), /nonempty/i));
  check('oversized files rejected', () => assert.throws(() => validateVaultFile(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/jpeg', 'photo'), /5 MB/i));
  check('invalid document type rejected', () => assert.throws(() => validateVaultFile(jpeg, 'image/jpeg', '../evil'), /Unsupported document type/i));
  check('filename traversal sanitized', () => assert.ok(!safeVaultFileName('../evil\\photo.jpg').includes('/')));
  check('filename CRLF sanitized', () => assert.ok(!safeVaultFileName('bad%0d%0afile.jpg').includes('\n')));
  check('rejection requires reason', () => assert.equal(vaultReviewSchema.safeParse({ status: 'REJECTED', expectedRevision: 1 }).success, false));
  check('valid rejection accepted', () => assert.equal(vaultReviewSchema.safeParse({ status: 'REJECTED', expectedRevision: 1, reason: 'Not a valid scan' }).success, true));
  check('stale missing revision rejected', () => assert.equal(vaultReviewSchema.safeParse({ status: 'VERIFIED' }).success, false));
  check('invalid status rejected', () => assert.equal(vaultReviewSchema.safeParse({ status: 'APPROVED', expectedRevision: 1 }).success, false));
  check('query max length enforced', () => assert.equal(vaultListSchema.safeParse({ search: 'x'.repeat(121) }).success, false));
  return checks;
}

async function run() {
  dotenv.config({ path: path.join(backend, '.env'), quiet: true });
  const ruleCount = checkFileRules();
  if (process.env.NODE_ENV === 'production') throw new Error('NEVER run tests in production');
  const sourceRaw = process.env.VAULT_TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!sourceRaw) throw new Error('Provide VAULT_TEST_DATABASE_URL pointing exclusively at localhost PostgreSQL.');
  const source = new URL(sourceRaw);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
    throw new Error('Vault integration requires a localhost PostgreSQL server. Refusing nonlocal host.');
  }
  const dbName = 'vault_fixture_' + randomUUID().replace(/-/g, '');
  const tempUrl = new URL(source);
  tempUrl.pathname = '/' + dbName;
  tempUrl.searchParams.delete('schema');
  const env = {
    ...process.env, NODE_ENV: 'test',
    DATABASE_URL: tempUrl.toString(), DIRECT_URL: tempUrl.toString(),
    JWT_ACCESS_SECRET: 'vault-test-access-only-never-production',
    JWT_REFRESH_SECRET: 'vault-test-refresh-only-never-production',
    QR_SECRET: 'vault-test-qr-only-never-production',
  };
  for (const name of Object.keys(env)) if (name.startsWith('R2_') || name.startsWith('SUPABASE_')) env[name] = '';
  Object.assign(process.env, env);

  const admin = new Client({ connectionString: source.toString() });
  await admin.connect();
  let db: any = null;
  let listener: any = null;
  let created = false;
  let tests = 0;
  const check = async (name: string, callback: () => unknown | Promise<unknown>) => {
    await callback(); tests++; console.log('PASS: ' + name);
  };
  try {
    await admin.query('CREATE DATABASE "' + dbName + '"');
    created = true;
    const cli = path.join(backend, 'node_modules', 'prisma', 'build', 'index.js');
    execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', path.join(backend, 'prisma', 'schema.prisma')], {
      cwd: backend, env, stdio: 'pipe',
    });
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient();
    await db.$connect();

    const { supabaseStorage } = await import('../src/lib/supabaseStorage');
    const originals = {
      uploadFile: supabaseStorage.uploadFile,
      downloadFile: supabaseStorage.downloadFile,
    };
    const remoteFiles = new Map<string, Buffer>();
    const originalConfigured = Object.getOwnPropertyDescriptor(supabaseStorage, 'configured');
    Object.defineProperty(supabaseStorage, 'configured', { configurable: true, get: () => true });
    (supabaseStorage as any).uploadFile = async (bucket: string, objectPath: string, body: Buffer) => {
      const key = bucket + '/' + objectPath;
      if (remoteFiles.has(key)) throw new Error('Attempted overwrite of historical object');
      remoteFiles.set(key, Buffer.from(body));
      return { path: objectPath };
    };
    (supabaseStorage as any).downloadFile = async (bucket: string, objectPath: string) =>
      remoteFiles.get(bucket + '/' + objectPath) || null;

    const { default: app } = await import('../src/app');
    const { signAccessToken } = await import('../src/lib/jwt');
    const user = (id: string, role: 'ADMIN' | 'TEACHER' | 'ACCOUNTANT') =>
      db.user.create({ data: { id, name: 'Fixture ' + role, email: id + '@test.invalid', passwordHash: 'not-a-real-password', role } });
    await user('vault-admin', 'ADMIN');
    await user('vault-teacher', 'TEACHER');
    await user('vault-accountant', 'ACCOUNTANT');
    const createStudent = async (id: string, currentClass: string) => db.student.create({
      data: {
        id, applicationNo: 'VAULT-' + id, qrToken: 'QR-' + id,
        fullName: 'Synthetic Candidate ' + id, fatherName: 'Synthetic Parent',
        gender: 'FEMALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'FAKE-CNIC-' + id,
        address: 'Fixture address', district: 'Fixture', province: 'Fixture', parentMobile: '0000000000',
        currentClass, schoolName: 'Fixture School', boardOrUniversity: 'Fixture Board',
        scholarshipCategory: 'GENERAL_MERIT', emergencyContact: '0000000000', emergencyRelation: 'Guardian',
      },
    });
    await createStudent('vault-student-1', 'Class 9th');
    await createStudent('vault-student-2', 'Class 10th');

    listener = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => listener.once('listening', resolve));
    const endpoint = 'http://127.0.0.1:' + listener.address().port;
    const token = (role: 'ADMIN' | 'TEACHER' | 'ACCOUNTANT') => signAccessToken({
      userId: 'vault-' + role.toLowerCase(),
      email: 'vault-' + role.toLowerCase() + '@test.invalid',
      name: 'Fixture ' + role, role, tokenVersion: 0,
    });
    const auth = (role: 'ADMIN' | 'TEACHER' | 'ACCOUNTANT') => ({ Authorization: 'Bearer ' + token(role) });
    const get = (route: string, role: 'ADMIN' | 'TEACHER' | 'ACCOUNTANT' = 'ADMIN') =>
      fetch(endpoint + route, { headers: auth(role) });
    const postBinary = (route: string, bytes: Buffer, mime: string, student: string, type: string, role: 'ADMIN' | 'TEACHER' | 'ACCOUNTANT' = 'ADMIN', method: 'POST' | 'PUT' = 'POST') =>
      fetch(endpoint + route, {
        method, headers: {
          ...auth(role), 'Content-Type': mime, 'X-Candidate-Key': student,
          'X-Document-Type': type, 'X-File-Name': encodeURIComponent(type + '.jpg'),
        },
        body: new Uint8Array(bytes),
      });
    const review = (id: string, revision: number, status: string, reason?: string, role: 'ADMIN' | 'TEACHER' | 'ACCOUNTANT' = 'ADMIN') =>
      fetch(endpoint + '/api/vault/documents/' + id + '/review', {
        method: 'PATCH', headers: { ...auth(role), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedRevision: revision, ...(reason ? { reason } : {}) }),
      });

    await check('Unauthenticated vault denied', async () => {
      const response = await fetch(endpoint + '/api/vault/documents');
      assert.equal(response.status, 401);
    });
    await check('Teacher vault denied', async () => assert.equal((await get('/api/vault/documents', 'TEACHER')).status, 403));
    await check('Accountant vault denied', async () => assert.equal((await get('/api/vault/documents', 'ACCOUNTANT')).status, 403));

    const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
    const changed = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 90, g: 80, b: 70 } } }).jpeg().toBuffer();
    const uploadRes = await postBinary('/api/vault/documents', image, 'image/jpeg', 'vault-student-1', 'bform');
    const uploadData = await uploadRes.json() as any;
    await check('Admin upload creates real file metadata', async () => {
      assert.equal(uploadRes.status, 201, JSON.stringify(uploadData.error));
      assert.equal(uploadData.data.reviewStatus, 'PENDING_REVIEW');
      assert.equal(uploadData.data.revision, 1);
    });
    const id = uploadData.data.id as string;

    await check('Private file bytes match upload', async () => {
      const response = await get('/api/vault/documents/' + id + '/file');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
    });
    await check('Teacher cannot retrieve private file', async () => assert.equal((await get('/api/vault/documents/' + id + '/file', 'TEACHER')).status, 403));
    await check('Teacher cannot upload a document', async () => assert.equal((await postBinary('/api/vault/documents', image, 'image/jpeg', 'vault-student-1', 'bform', 'TEACHER')).status, 403));
    await check('Invalid student or document headers produce 400 instead of 500', async () => {
      assert.equal((await postBinary('/api/vault/documents', image, 'image/jpeg', '', 'bform')).status, 400);
      assert.equal((await postBinary('/api/vault/documents', image, 'image/jpeg', 'vault-student-1', '../evil')).status, 400);
    });
    await check('Accountant cannot review a document', async () => assert.equal((await review(id, 1, 'VERIFIED', undefined, 'ACCOUNTANT')).status, 403));
    await check('Unknown document access returns 404', async () => assert.equal((await get('/api/vault/documents/not-a-real-document/file')).status, 404));

    await check('Database-wide listing reports pending review', async () => {
      const r = await get('/api/vault/documents?type=bform&class=Class%209th');
      const d = (await r.json() as any).data;
      assert.equal(r.status, 200);
      assert.equal(d.pagination.total, 1);
      assert.equal(d.summary.PENDING_REVIEW, 1);
      assert.equal(d.documents[0].id, id);
      assert.ok(!JSON.stringify(d.documents).includes('objectPath'));
      assert.ok(d.classes.includes('Class 10th'));
    });

    await check('Missing rejection reason rejected', async () => {
      assert.equal((await review(id, 1, 'REJECTED')).status, 400);
    });
    const denied = await review(id, 1, 'REJECTED', 'Image is unreadable');
    await check('Reject records durable status and reason', async () => {
      assert.equal(denied.status, 200);
      const meta = await db.studentDocument.findUniqueOrThrow({ where: { id } });
      assert.equal(meta.reviewStatus, 'REJECTED');
      assert.equal(meta.rejectionReason, 'Image is unreadable');
      assert.equal(meta.revision, 2);
    });
    await check('Stale concurrent review rejected', async () => assert.equal((await review(id, 1, 'VERIFIED')).status, 409));
    const verified = await review(id, 2, 'VERIFIED');
    await check('Verification records actor and clears reason', async () => {
      assert.equal(verified.status, 200);
      const meta = await db.studentDocument.findUniqueOrThrow({ where: { id } });
      assert.equal(meta.reviewStatus, 'VERIFIED');
      assert.equal(meta.rejectionReason, null);
      assert.equal(meta.reviewedById, 'vault-admin');
      assert.equal(meta.revision, 3);
    });

    const oldKeys = [...remoteFiles.keys()];
    const replaced = await postBinary('/api/vault/documents/' + id + '/file?revision=3', changed, 'image/jpeg', 'vault-student-1', 'bform', 'ADMIN', 'PUT');
    await check('Replacement produces new immutable key and resets review', async () => {
      assert.equal(replaced.status, 200, await replaced.text().catch(()=>''));
      const meta = await db.studentDocument.findUniqueOrThrow({ where: { id } });
      assert.equal(meta.reviewStatus, 'PENDING_REVIEW');
      assert.equal(meta.revision, 4);
      assert.equal(remoteFiles.size, 2);
      assert.ok(oldKeys.every(key => remoteFiles.has(key)));
    });
    await check('Previous version downloadable through protected history', async () => {
      const historyRes = await get('/api/vault/documents/' + id + '/history');
      const history = (await historyRes.json() as any).data;
      assert.equal(historyRes.status, 200);
      assert.equal(history.pagination.total, 4);
      const event = history.events.find((item: any) => item.action === 'REPLACED');
      assert.ok(event?.priorVersionAvailable);
      const prior = await get('/api/vault/documents/' + id + '/history/' + event.id + '/file');
      assert.equal(prior.status, 200);
      assert.deepEqual(Buffer.from(await prior.arrayBuffer()), image);
    });
    await check('Concurrent reviews only one wins at a revision', async () => {
      const outcomes = await Promise.all([
        review(id, 4, 'VERIFIED'),
        review(id, 4, 'REJECTED', 'Unclear scan'),
      ]);
      assert.deepEqual(outcomes.map(r => r.status).sort(), [200, 409]);
      assert.equal(await db.studentDocumentAudit.count({ where: { documentId: id } }), 5);
    });

    await check('Stale replacement does not upload a new private object', async () => {
      const beforeCount = remoteFiles.size;
      const response = await postBinary('/api/vault/documents/' + id + '/file?revision=3', changed, 'image/jpeg', 'vault-student-1', 'bform', 'ADMIN', 'PUT');
      assert.equal(response.status, 409);
      assert.equal(remoteFiles.size, beforeCount);
    });
    await check('Truncated JPEG with genuine magic is rejected on decode', async () => {
      const response = await postBinary('/api/vault/documents', Buffer.from([255,216,255,217]), 'image/jpeg', 'vault-student-1', 'bform');
      assert.equal(response.status, 400);
    });
    await check('Tampered MIME content rejected without new metadata', async () => {
      const response = await postBinary('/api/vault/documents', Buffer.from('<script>'), 'image/jpeg', 'vault-student-1', 'bform');
      assert.equal(response.status, 400);
      assert.equal(await db.studentDocument.count(), 1);
    });

    await check('New student photo creates private thumbnail outside review listings', async () => {
      const response = await postBinary('/api/vault/documents', image, 'image/jpeg', 'vault-student-2', 'photo');
      assert.equal(response.status, 201);
      const savedThumbnail = await db.studentDocument.findFirst({ where: { studentId: 'vault-student-2', documentType: 'photoThumbnail' } });
      assert.ok(savedThumbnail);
      const listing = await get('/api/vault/documents');
      assert.equal((await listing.json() as any).data.pagination.total, 2);
    });

    await check('Legacy candidate document getter resolves managed Vault bytes', async () => {
      const { studentsService } = await import('../src/modules/students/students.service');
      const result = await studentsService.getStudentDocument('vault-student-2', 'photo');
      assert.deepEqual(result.buffer, image);
    });

    await check('Document review does not rewrite overall student eligibility', async () => {
      const office = await db.officeUseRecord.findUnique({ where: { studentId: 'vault-student-1' } });
      assert.equal(office, null);
    });

    (supabaseStorage as any).uploadFile = originals.uploadFile;
    (supabaseStorage as any).downloadFile = originals.downloadFile;
    if (originalConfigured) Object.defineProperty(supabaseStorage, 'configured', originalConfigured);
    else delete (supabaseStorage as any).configured;

    console.log('VAULT_MANAGEMENT_PASS=' + (ruleCount + tests) + ' VAULT_MANAGEMENT_FAIL=0');
  } finally {
    if (listener) await new Promise<void>(resolve => listener.close(() => resolve()));
    if (db) await db.$disconnect();
    try { const { prisma } = await import('../src/lib/prisma'); await prisma.$disconnect(); } catch {}
    if (created) {
      try {
        await admin.query('DROP DATABASE "' + dbName + '" WITH (FORCE)');
        console.log('DISPOSABLE_DATABASE_DROPPED=' + dbName);
      } catch (error) {
        console.error('DISPOSABLE_DB_CLEANUP_REQUIRED=' + dbName);
        throw error;
      }
    }
    await admin.end();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
