import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import sharp from 'sharp';
import { disposableStaffDatabase } from './staff-payments-teacher-accounts-migration.test';
import { captureAdminRequests } from './hssc-capture.test';
import { HSSC_GROUP_OPTIONS, classifyHsscClass, resolveHsscGroup } from '../src/modules/students/hsscContract';

async function run() {
  const fixture = await disposableStaffDatabase();
  let db: any, server: any;
  try {
    Object.assign(process.env, { DATABASE_URL: fixture.url, DIRECT_URL: fixture.url, NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'synthetic-hssc-access-only', JWT_REFRESH_SECRET: 'synthetic-hssc-refresh-only', QR_SECRET: 'synthetic-hssc-qr-only',
      SUPABASE_SERVICE_ROLE_KEY: '', R2_BUCKET: '', R2_ACCOUNT_ID: '', R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '' });
    const shared = await import('../src/lib/prisma'); db = shared.prisma;
    const { studentsService: students } = await import('../src/modules/students/students.service');
    const { pdfService } = await import('../src/modules/documents/pdf.service');
    const { supabaseStorage: storage } = await import('../src/lib/supabaseStorage');
    const { default: router } = await import('../src/modules/students/students.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    const { signAccessToken } = await import('../src/lib/jwt');
    const { createStudentSchema, updateStudentSchema } = await import('../src/modules/students/students.schema');
    const actor = { userId: 'HSSC_ADMIN', name: 'Synthetic Staff', role: 'SUPER_ADMIN' };
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'ACCOUNTANT']) await db.user.create({ data: {
      id: role === 'SUPER_ADMIN' ? actor.userId : role, name: 'Synthetic Staff', email: role + '@hssc.test.invalid', passwordHash: 'fixture-only', role,
    } });
    const token = (role = 'SUPER_ADMIN') => signAccessToken({ userId: role === 'SUPER_ADMIN' ? actor.userId : role, name: actor.name, email: role + '@hssc.test.invalid', role, tokenVersion: 0 });
    const app = express(); app.use(express.json({ limit: '1mb' })); app.use('/api/students', router); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const request = async (route: string, method = 'GET', body?: any, role: string | null = 'SUPER_ADMIN') => {
      const response = await fetch(origin + '/api/students' + route, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: 'Bearer ' + token(role) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { response, body: response.headers.get('content-type')?.includes('application/json') ? await response.json() as any : Buffer.from(await response.arrayBuffer()) };
    };
    let checks = 0;
    const check = async (label: string, work: () => any) => { await work(); console.log('PASS: ' + label); checks++; };
    const captured = await captureAdminRequests(origin, token());
    const [first, second] = captured.created;
    await check('real admin browser requests persist, reload and detail API returns selected groups', async () => {
      for (const [student, group] of [[first, 'Pre-Engineering'], [second, 'ICS']]) {
        assert.equal((await db.student.findUnique({ where: { id: student.id } })).hsscGroup, group);
        assert.equal((await request('/' + student.id)).body.data.hsscGroup, group);
      }
    });
    const base = { ...captured.bodies[0], cnicOrBForm: 'SYNTHETIC-PUBLIC', currentClass: 'HSSC 1' };
    await check('all create adapters reject missing, unsupported, conflicting and hidden-default groups', async () => {
      for (const endpoint of ['/admin-register', '/', '/register']) for (const hsscGroup of [undefined, null, '', 'Science', 'Pre-Medical / ICS', 'Science / Pre-Medical', 'Science (Biology/Pre-Medical)']) {
        const result = await request(endpoint, 'POST', { ...base, hsscGroup });
        assert.equal(result.response.status, 400); assert(result.body.error.details.hsscGroup);
      }
      assert(!createStudentSchema.safeParse({ ...base, currentClass: 'HSSC-I (Class 12th)', hsscGroup: 'ICS' }).success);
    });
    await check('public explicit alias is canonicalized and retains required stored-document verification', async () => {
      const cnic = 'SYNTHETIC-PUBLIC';
      const uploadedDocuments = Object.fromEntries(['photo', 'bform', 'fatherCnic', 'dmc', 'signature'].map(type => [type, { bucket: type === 'photo' ? 'student-photos' : 'student-documents', supabasePath: cnic + '/' + type + '.png', mimeType: 'image/png', name: type + '.png' }]));
      const original = storage.fileExists;
      let verified = 0;
      storage.fileExists = async () => { verified++; return true; };
      try {
        const result = await request('/register', 'POST', { ...base, hsscGroup: 'Pre-Engg', uploadedDocuments }, null);
        assert.equal(result.response.status, 201, JSON.stringify(result.body)); assert.equal(result.body.data.hsscGroup, 'Pre-Engineering'); assert.equal(verified, 5);
        const row = await db.student.findUnique({ where: { id: result.body.data.id } }); assert.equal(row.hsscGroup, 'Pre-Engineering');
      } finally { storage.fileExists = original; }
      const invalid = await request('/register', 'POST', { ...base, cnicOrBForm: 'SYNTHETIC-UNSTORED', hsscGroup: 'ICS', photoUrl: 'unverified', uploadedDocuments: { bform: 'unverified', fatherCnic: 'unverified', dmc: 'unverified', signature: 'unverified' } }, null);
      assert.equal(invalid.response.status, 502); assert.equal(await db.student.count({ where: { cnicOrBForm: 'SYNTHETIC-UNSTORED' } }), 0);
    });
    const rowData = (input: any) => { const { academicRecords, documents, uploadedDocuments, signatureDataUrl, signature, ...data } = createStudentSchema.parse(input); return data; };
    const legacy = await db.student.create({ data: { ...rowData({ ...base, hsscGroup: 'ICS', cnicOrBForm: 'SYNTHETIC-LEGACY' }), id: 'legacy-hssc', applicationNo: 'SYNTHETIC-LEGACY', qrToken: 'synthetic-legacy', hsscGroup: null, currentClass: '12th' } });
    await check('unrelated PATCH preserves valid groups and permits incomplete legacy contact corrections', async () => {
      assert.deepEqual(updateStudentSchema.parse({ address: 'Changed' }), { address: 'Changed' });
      for (const currentClass of ['class 11th', '11', 'hssc 1', 'FIRST YEAR']) {
        const result = await request('/' + first.id, 'PATCH', { currentClass, address: 'Synthetic corrected address' }); assert.equal(result.response.status, 200); assert.equal(result.body.data.hsscGroup, 'Pre-Engineering');
      }
      const result = await request('/' + legacy.id, 'PATCH', { currentClass: 'class 12th', parentMobile: '03000000000' }); assert.equal(result.response.status, 200); assert.equal(result.body.data.hsscGroup, null);
      assert.equal((await request('/' + legacy.id, 'PATCH', { hsscGroup: null })).response.status, 400);
      assert.equal((await request('/' + legacy.id, 'PATCH', { currentClass: '11th' })).response.status, 400);
    });
    await check('correction is atomic, audited, reloaded and rejects stale/concurrent/unauthorized writes', async () => {
      const row = await db.student.findUnique({ where: { id: legacy.id } });
      const patch = { hsscGroup: 'FA', correctionBasis: 'Verified by synthetic staff from current admission form', expectedUpdatedAt: row.updatedAt.toISOString() };
      assert.equal((await request('/' + legacy.id, 'PATCH', patch, 'TEACHER')).response.status, 403);
      const results = await Promise.all([request('/' + legacy.id, 'PATCH', patch), request('/' + legacy.id, 'PATCH', { ...patch, hsscGroup: 'ICS' })]);
      assert.deepEqual(results.map(r => r.response.status).sort(), [200, 409]);
      assert.equal((await request('/' + legacy.id, 'PATCH', patch)).response.status, 409);
      const audit = await db.studentStudyGroupCorrection.findMany({ where: { studentId: legacy.id } }); assert.equal(audit.length, 1); assert.equal(audit[0].oldGroup, null); assert.equal(audit[0].actorId, actor.userId); assert(audit[0].correctedAt && audit[0].basis);
      const detail = (await request('/' + legacy.id)).body.data; assert.equal(detail.hsscGroup, audit[0].newGroup);
      await assert.rejects(() => db.studentStudyGroupCorrection.updateMany({ data: { basis: 'tampered' } }));
      await assert.rejects(() => db.studentStudyGroupCorrection.deleteMany({}));
      await assert.rejects(() => fixture.sql.query('TRUNCATE "StudentStudyGroupCorrection"'));
      const protection = await students.getDeletionProtection(legacy.id); assert.equal(protection.counts.groupCorrections, 1);
      const before = await db.student.findUnique({ where: { id: first.id } });
      await assert.rejects(() => students.updateStudent(first.id, { hsscGroup: 'ICS', expectedUpdatedAt: before.updatedAt.toISOString() }, actor));
      assert.equal((await db.student.findUnique({ where: { id: first.id } })).hsscGroup, before.hsscGroup);
    });
    const missing = await db.student.create({ data: { ...rowData({ ...base, hsscGroup: 'ICS', cnicOrBForm: 'SYNTHETIC-MISSING' }), id: 'missing-hssc', applicationNo: 'SYNTHETIC-MISSING', qrToken: 'synthetic-missing', hsscGroup: 'Science (Biology/Pre-Medical)' } });
    await check('single, direct, prepare and bulk printing block unresolved groups before any reservations', async () => {
      const reservations = await db.officeUseRecord.count();
      for (const route of ['/' + missing.id + '/omr-sheet-pdf', '/' + missing.id + '/roll-slip-pdf']) assert.equal((await request(route)).response.status, 409);
      assert.equal((await request('/' + missing.id + '/prepare-print', 'POST')).response.status, 409);
      for (const route of ['/bulk-omr-pdf', '/bulk-roll-slips-pdf']) {
        const result = await request(route, 'POST', { studentIds: [first.id, missing.id, second.id] });
        assert.equal(result.response.status, 409); assert.deepEqual(result.body.error.details.readyIds, [first.id, second.id]);
        assert.equal(result.body.error.details.unresolved[0].id, missing.id);
      }
      assert.equal(await db.officeUseRecord.count(), reservations);
      const readiness = await request('/print-readiness', 'POST', { studentIds: [second.id, missing.id, first.id] });
      assert.deepEqual(readiness.body.data.readyIds, [second.id, first.id]); assert.equal(await db.officeUseRecord.count(), reservations);
      assert.equal((await request('/bulk-omr-pdf', 'POST', { studentIds: [first.id, first.id] })).response.status, 400);
      assert.equal((await request('/bulk-omr-pdf', 'POST', { studentIds: [first.applicationNo] })).response.status, 404);
      assert.equal(await db.officeUseRecord.count(), reservations);
      for (const role of [null, 'TEACHER', 'ACCOUNTANT']) for (const route of ['/bulk-omr-pdf', '/print-readiness']) assert.equal((await request(route, 'POST', { studentIds: [first.id] }, role)).response.status, role ? 403 : 401);
      for (const role of [null, 'TEACHER', 'ACCOUNTANT']) assert.equal((await request('/' + first.id + '/omr-sheet-pdf', 'GET', undefined, role)).response.status, role ? 403 : 401);
    });
    await check('review filter covers the full matching roster and preserves raw legacy values', async () => {
      const result = await request('?studyGroupReview=true&limit=1'); assert.equal(result.response.status, 200); assert.equal(result.body.data.pagination.total, 1); assert.equal(result.body.data.students[0].hsscGroup, 'Science (Biology/Pre-Medical)');
      const original = pdfService.generateStudentsListHtml;
      let exported: string[] = [];
      pdfService.generateStudentsListHtml = function(...args: Parameters<typeof original>) { exported = args[0].map((s: any) => s.id); return original.apply(this, args); };
      try { assert.equal((await request('/export-pdf?studyGroupReview=true')).response.status, 200); assert.deepEqual(exported, [missing.id]); }
      finally { pdfService.generateStudentsListHtml = original; }
    });
    const output = path.resolve(__dirname, '../../tmp/hssc-flow-20261020'); fs.mkdirSync(output, { recursive: true });
    const portrait = await sharp({ create: { width: 90, height: 120, channels: 3, background: '#185b9d' } }).png().toBuffer();
    // Synthetic portrait injection only; real candidate-number reservation, QR pairing, service and renderer remain active.
    students.resolveStudentPhotoBase64 = async () => 'data:image/png;base64,' + portrait.toString('base64');
    await check('actual single/direct and explicit ready-subset bulk PDFs render in exact selection order', async () => {
      for (const student of [first, second]) {
        const result = await request('/' + student.id + '/omr-sheet-pdf'); assert.equal(result.response.status, 200);
        assert((result.body as Buffer).subarray(0, 4).toString() === '%PDF'); fs.writeFileSync(path.join(output, student === first ? 'first-year-omr.pdf' : 'second-year-omr.pdf'), result.body);
      }
      const bulk = await request('/bulk-omr-pdf', 'POST', { studentIds: [second.id, first.id] }); assert.equal(bulk.response.status, 200); fs.writeFileSync(path.join(output, 'ready-subset-omr.pdf'), bulk.body);
      const ready = await request('/print-readiness', 'POST', { studentIds: [second.id, first.id] }); assert.deepEqual(ready.body.data.readyIds, [second.id, first.id]);
      fs.writeFileSync(path.join(output, 'pdf-candidate-manifest.json'), JSON.stringify([second, first].map(s => ({ id: s.id, applicationNo: s.applicationNo, group: s.hsscGroup })), null, 2));
      const row = await db.student.findUnique({ where: { id: missing.id } });
      const correction = await request('/' + missing.id, 'PATCH', { hsscGroup: 'ICS', expectedUpdatedAt: row.updatedAt.toISOString(), correctionBasis: 'Synthetic documentary verification' }); assert.equal(correction.response.status, 200);
      assert.equal((await request('/print-readiness', 'POST', { studentIds: [missing.id] })).body.data.unresolved.length, 0);
      assert.equal((await request('/' + missing.id + '/omr-sheet-pdf')).response.status, 200);
      // Non-HSSC candidates still print without a group.
      const non = await db.student.create({ data: { ...rowData({ ...base, currentClass: 'Class 10th', cnicOrBForm: 'SYNTHETIC-SSC' }), id: 'ssc-control', applicationNo: 'SYNTHETIC-SSC', qrToken: 'synthetic-ssc', hsscGroup: null } });
      assert.equal((await request('/' + non.id + '/omr-sheet-pdf')).response.status, 200);
      assert.throws(() => pdfService.generateOmrSheetHtml({ ...first, hsscGroup: null }), (e: any) => e.code === 'HSSC_GROUP_REVIEW_REQUIRED');
    });
    await check('the final renderer rechecks database changes after readiness and portrait resolution', async () => {
      const originalPhoto = students.resolveStudentPhotoBase64;
      students.resolveStudentPhotoBase64 = async () => { await db.student.update({ where: { id: first.id }, data: { hsscGroup: null } }); return originalPhoto(first); };
      try { assert.equal((await request('/' + first.id + '/omr-sheet-pdf')).response.status, 409); }
      finally { students.resolveStudentPhotoBase64 = originalPhoto; await db.student.update({ where: { id: first.id }, data: { hsscGroup: 'Pre-Engineering' } }); }
    });
    console.log(`HSSC_FLOW_PASS=${checks}; synthetic database only; artifacts=${output}`);
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await db?.$disconnect(); await fixture.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
