import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { Client } from 'pg';
async function run() {
    assert.notEqual(process.env.NODE_ENV, 'production');
    const url = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || 'postgresql://fixture@127.0.0.1:55439/postgres');
    assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Synthetic localhost database required');
    url.pathname = '/postgres';
    const owner = new Client({ connectionString: url.toString() });
    await owner.connect();
    const suffix = randomUUID().replaceAll('-', ''), database = 'exam_control_' + suffix, role = 'exam_runtime_' + suffix, capabilityOwner = 'exam_cap_' + suffix;
    let admin: Client | undefined, db: any, shared: any;
    let passed = 0;
    const check = async (label: string, work: () => any) => { await work(); passed++; console.log('PASS ' + label); };
    try {
        await owner.query(`CREATE DATABASE "${database}"`);
        url.pathname = '/' + database;
        admin = new Client({ connectionString: url.toString() });
        await admin.connect();
        const version = (await admin.query('SHOW server_version_num')).rows[0].server_version_num;
        console.log('PostgreSQL ' + version);
        if (process.env.REQUIRE_PG17 === 'true')
            assert(Number(version) >= 170000 && Number(version) < 180000);
        for (const folder of fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).sort()) {
            const file = path.resolve(__dirname, '../prisma/migrations', folder, 'migration.sql');
            if (fs.existsSync(file)) {
                if (folder === '20261019000100_pre_open_enum') {
                    for (const legacyId of ['legacy', 'legacy-archived', 'legacy-newer-exam'])
                        await admin.query(`INSERT INTO "Student"(id,"applicationNo","qrToken","fullName","fatherName",gender,"dateOfBirth","cnicOrBForm",address,district,province,"parentMobile","currentClass","schoolName","boardOrUniversity","scholarshipCategory","emergencyContact","emergencyRelation","testScore","updatedAt") VALUES($1,'APP-' || $1,'synthetic-' || $1 || '-qr','Legacy fixture','Fixture','MALE','2008-01-01',$1 || '-fixture','Fixture','Fixture','Fixture','fixture','Class 9th','Fixture','Fixture','GENERAL_MERIT','fixture','Fixture',77,CURRENT_TIMESTAMP)`, [legacyId]);
                }
                await admin.query(fs.readFileSync(file, 'utf8'));
            }
        }
        console.log('PASS full migration chain');
        await admin.query("SELECT set_config('azm.control_owner_role',$1,false)", [capabilityOwner]);
        await admin.query(fs.readFileSync(path.resolve(__dirname, '../ops/postgres/exam-control-capability.sql'), 'utf8'));
        const signingKey = 'synthetic-exam-control-signing-key-' + randomUUID() + randomUUID();
        process.env.EXAM_CONTROL_SIGNING_KEY = signingKey;
        await admin.query('INSERT INTO azm_control_private.signing_key(secret) VALUES($1)', [signingKey]);
        const runtimePassword = randomUUID().replaceAll('-', '');
        await owner.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${runtimePassword}'`);
        await admin.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO "${role}"; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${role}"; REVOKE ALL ON SCHEMA azm_control_private FROM "${role}"; REVOKE DELETE,TRUNCATE ON "Attendance","AttendanceSession","AttendanceSessionCandidate" FROM "${role}"; REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON "ExamControlOperation","ExamPlacementControl","ExamAttemptSequence","ExamLifecycleEvent" FROM "${role}"; REVOKE UPDATE,DELETE,TRUNCATE ON "AttendanceResetOperation","AttendanceSessionCancellation","AttendanceSessionReopening" FROM "${role}"; GRANT EXECUTE ON FUNCTION azm_execute_exam_control(TEXT,TEXT),azm_exam_capability_probe(TEXT,TEXT) TO "${role}";`);
        url.username = role;
        url.password = runtimePassword;
        process.env.DATABASE_URL = url.toString();
        process.env.DIRECT_URL = url.toString();
        process.env.NODE_ENV = 'test';
        await admin.query(`CREATE POLICY azm_backend_private_documents ON public."StudentDocument" FOR ALL TO "${role}" USING (true) WITH CHECK (true)`);
        const { PrismaClient } = await import('@prisma/client');
        db = new PrismaClient();
        const { ExamControlService } = await import('../src/modules/attendance/examControl.service');
        const { AttendanceService } = await import('../src/modules/attendance/attendance.service');
        const { ExamHallsService, hallDate } = await import('../src/modules/exam-halls/examHalls.service');
        const { qrService } = await import('../src/modules/attendance/qr.service');
        const control = new ExamControlService(db), attendance = new AttendanceService(db), halls = new ExamHallsService(db);
        const { AttendanceCancellationService } = await import('../src/modules/attendance/attendanceCancellation.service');
        const cancellation = new AttendanceCancellationService(db);
        for (const roleName of ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'ACCOUNTANT'])
            await db.user.create({ data: { id: roleName, name: roleName, email: roleName + '@test.invalid', passwordHash: 'fixture', role: roleName } });
        for (const id of ['A', 'B'])
            await db.testCenter.create({ data: { id, name: 'Center ' + id, code: id, address: 'Synthetic', district: 'Synthetic', testDate: '2026-11-15' } });
        for (const [id, center] of [['a', 'A'], ['b', 'A'], ['other', 'B']])
            await db.examHall.create({ data: { id, name: 'Hall ' + id, roomNumber: id, targetClass: 'Class 9th', examDate: '2026-11-15', reportingTime: '09:00 AM', testCenterId: center } });
        const candidate = (id: string, hall: string, seat: string) => ({ id, applicationNo: 'APP-' + id, qrToken: qrService.generateSignedQrToken(id), fullName: 'Synthetic ' + id, fatherName: 'Synthetic', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'fixture-' + id, address: 'Fixture', district: 'Fixture', province: 'Fixture', parentMobile: 'fixture', currentClass: 'Class 9th', schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: 'fixture', emergencyRelation: 'Fixture', assignedHallId: hall, seatNo: seat });
        for (const [id, hall, seat] of [['a1', 'a', 'Seat #01'], ['a2', 'a', 'Seat #02'], ['b1', 'b', 'Seat #01'], ['o1', 'other', 'Seat #01']])
            await db.student.create({ data: candidate(id, hall, seat) });
        const scope = (action: string, ids: string[] = [], extra: any = {}) => ({ action, testCenterId: 'A', businessDate: '2026-11-15', sessionIds: ids, entireLineage: false, clearAllocations: false, unfreeze: false, replace: true, ...extra });
        const confirm = (p: any, key = randomUUID(), reason = 'Synthetic control operation') => control.confirm({ challenge: p.challenge, reason, confirmationText: p.phrase }, 'SUPER_ADMIN', 0, key);
        const act = async (action: string, ids: string[] = [], extra: any = {}) => confirm(await control.preview(scope(action, ids, extra), 'SUPER_ADMIN', 0));
        const rejects = (f: () => any, status?: number) => assert.rejects(f, (e: any) => status ? e.statusCode === status : true);
        const openHall = async (hallId: string) => {
            const hall = await db.examHall.findUnique({ where: { id: hallId } });
            const prepared = hall && await db.attendanceSession.findFirst({ where: { examHallId: hallId, businessDate: hallDate(hall.examDate), isCurrent: true } });
            return attendance.openSession(hallId, 'ADMIN', { sessionId: prepared?.id ?? 'missing', revision: prepared?.revision ?? 1 });
        };
        let a: any, b: any, other: any;
        await check('prepare persists PRE_OPEN with null opening metadata and live assignment counts', async () => { a = await control.prepare('a', 'ADMIN', 0); b = await control.prepare('b', 'ADMIN', 0); other = await control.prepare('other', 'ADMIN', 0); assert.equal(a.status, 'PRE_OPEN'); assert.equal(a.openedAt, null); assert.equal(a.openedByUserId, null); const detail = await attendance.getSession(a.id); assert.equal(detail.stats.expectedCount, 2); assert.equal(detail.stats.markedCount, 0); assert.equal(detail.roster.length, 0); });
        await check('PRE_OPEN cannot be scanned and legacy open endpoint cannot silently create', async () => { await rejects(() => attendance.mark(a.id, { studentId: 'a1', status: 'PRESENT', revision: 1 }, 'TEACHER'), 409); await rejects(() => openHall('missing'), 404); });
        await check('open uses current allocation and does not freeze', async () => { a = (await openHall('a')).session; b = (await openHall('b')).session; other = (await openHall('other')).session; assert.equal((await control.current('A', '2026-11-15')).placement.frozen, false); assert.equal((await attendance.getSession(a.id)).roster.length, 2); });
        const mark = async (s: any, id: string, status: 'PRESENT' | 'ABSENT' | 'LATE' = 'PRESENT') => { const current = await db.attendanceSession.findUnique({ where: { id: s.id } }); return attendance.mark(s.id, { studentId: id, status, revision: current.revision }, 'TEACHER'); };
        await check('close/reopen keeps all marks and closing-generated absences', async () => { await mark(a, 'a1', 'LATE'); await attendance.closeSession(a.id, true, 'ADMIN'); const before = await db.attendance.findMany({ where: { sessionId: a.id }, orderBy: { id: 'asc' } }); await attendance.reopenSession(a.id, 'Synthetic reopen preserves marks', 'SUPER_ADMIN', 0); assert.deepEqual(await db.attendance.findMany({ where: { sessionId: a.id }, orderBy: { id: 'asc' } }), before); assert.equal(before.length, 2); assert.equal((await control.current('A', '2026-11-15')).placement.frozen, false); });
        const fee = await db.feeRecord.create({ data: { studentId: 'a1', month: '2026-11', amountDue: 30, amountPaid: 30, status: 'PAID', challanNumber: 'fixture-challan', dueDate: new Date('2026-11-01') } });
        const document = await db.studentDocument.create({ data: { studentId: 'a1', documentType: 'bform', bucket: 'synthetic-only', objectPath: 'fixture/bform.png', mimeType: 'image/png' } });
        await db.student.update({ where: { id: 'o1' }, data: { testScore: 88, resultSessionId: other.id } });
        const identityBefore = await db.student.findUnique({ where: { id: 'a1' } }), otherBefore = await attendance.getSession(other.id);
        let reset: any, preview: any, idem = randomUUID();
        await check('preview is read-only and returns actual exact-scope impact', async () => { const count = await db.examControlOperation.count(); preview = await control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0); assert.equal(preview.totals.marks, 2); assert.equal(preview.totals.rosterEntries, 2); assert.equal(await db.examControlOperation.count(), count); });
        await check('reset deletes OPEN progress/session, creates fresh PRE_OPEN, retains identity and audits', async () => { reset = await confirm(preview, idem); assert.equal(reset.deletedMarks, 2); assert.equal(reset.replacements.length, 1); assert.equal(await db.attendanceSession.findUnique({ where: { id: a.id } }), null); assert.equal(await db.attendance.count({ where: { sessionId: a.id } }), 0); assert.equal(await db.attendanceSessionReopening.count({ where: { sessionId: a.id } }), 1); const fresh = await attendance.getSession(reset.replacements[0].newSessionId); assert.equal(fresh.session.status, 'PRE_OPEN'); assert.equal(fresh.session.attemptNumber, 2); assert.equal(fresh.stats.markedCount, 0); assert.equal(fresh.stats.expectedCount, 2); assert.equal(fresh.roster.length, 0); assert.deepEqual(await db.student.findUnique({ where: { id: 'a1' } }), identityBefore); });
        await check('same request replays after deletion; different request with same key rejects', async () => { assert.deepEqual(await confirm(preview, idem), reset); await rejects(() => confirm(preview, idem, 'A different synthetic reason'), 409); assert.equal((await control.operation('SUPER_ADMIN', 0, idem) as any).operationId, reset.operationId); });
        await check('old attempt IDs and stale revisions cannot scan replacement', async () => { await rejects(() => attendance.mark(a.id, { studentId: 'a1', status: 'PRESENT', revision: 2 }, 'TEACHER'), 409); const fresh = reset.replacements[0]; await openHall(fresh.examHallId); await rejects(() => attendance.mark(fresh.newSessionId, { studentId: 'a1', status: 'PRESENT', revision: 1 }, 'TEACHER'), 409); a = (await attendance.getSession(fresh.newSessionId)).session; });
        await check('explicit center freeze blocks source/destination/reseat/import and schedule writers, allows scans', async () => { await act('FREEZE'); assert.equal((await control.current('A', '2026-11-15')).placement.frozen, true); await rejects(() => halls.updateStudentAllocation('a1', { seatNo: 'Seat #09' })); await rejects(() => halls.updateStudentAllocation('o1', { assignedHallId: 'a' })); await rejects(() => db.student.update({ where: { id: 'a1' }, data: { seatNo: 'Seat #10' } })); await rejects(() => db.examHall.update({ where: { id: 'a' }, data: { roomNumber: 'changed' } })); await rejects(() => db.testCenter.update({ where: { id: 'A' }, data: { reportingTime: '11:00' } })); await mark(a, 'a1'); assert.equal((await control.current('B', '2026-11-15')).placement.frozen, false); assert.equal((await control.current('A', '2026-11-16')).placement.frozen, false); });
        await check('frozen allocation clearing requires explicit center-wide unfreeze and commits atomically', async () => { await rejects(() => control.preview(scope('RESET', [a.id], { clearAllocations: true }), 'SUPER_ADMIN', 0), 409); const p = await control.preview(scope('RESET', [a.id], { clearAllocations: true, unfreeze: true }), 'SUPER_ADMIN', 0); assert.equal(p.unfreezeScope.hallCount, 2); const result: any = await confirm(p); assert.equal(result.clearedAllocations, 2); assert.equal((await control.current('A', '2026-11-15')).placement.frozen, false); assert.equal((await db.student.findUnique({ where: { id: 'a1' } })).assignedHallId, null); a = (await attendance.getSession(result.replacements[0].newSessionId)).session; });
        await check('placement correction after prior opening works; next open rebuilds live roster', async () => { await halls.updateStudentAllocation('a2', { assignedHallId: 'a' }); await openHall('a'); a = (await attendance.getSession(a.id)).session; assert.deepEqual((await attendance.getSession(a.id)).roster.map((r: any) => r.studentId), ['a2']); });
        await check('unmarked OPEN moves update source/destination snapshots and revisions atomically', async () => { const old = b.revision; await halls.updateStudentAllocation('a2', { assignedHallId: 'b' }); assert.equal((await attendance.getSession(a.id)).roster.length, 0); const detail = await attendance.getSession(b.id); assert.equal(detail.roster.length, 2); assert(detail.session.revision > old); await rejects(() => attendance.mark(b.id, { studentId: 'a2', status: 'PRESENT', revision: old }, 'TEACHER'), 409); });
        await check('marked movement requires explicit reviewed reset rather than transferring marks', async () => { await mark(b, 'a2'); await rejects(() => halls.updateStudentAllocation('a2', { assignedHallId: 'a' })); assert.equal((await db.student.findUnique({ where: { id: 'a2' } })).assignedHallId, 'b'); });
        await check('stale previews reject after a scan, preserving all work', async () => { const p = await control.preview(scope('RESET', [b.id]), 'SUPER_ADMIN', 0); await mark(b, 'b1'); await rejects(() => confirm(p), 409); assert.equal(await db.attendance.count({ where: { sessionId: b.id } }), 2); });
        await check('CLOSED reset deletes closure marks and returns PRE_OPEN without auto-freezing', async () => { await attendance.closeSession(b.id, true, 'ADMIN'); const result: any = await act('RESET', [b.id]); b = (await attendance.getSession(result.replacements[0].newSessionId)).session; assert.equal(b.status, 'PRE_OPEN'); assert.equal((await control.current('A', '2026-11-15')).placement.frozen, false); });
        await check('all non-Super-Admin roles, stale tokens and inactive accounts rejected', async () => { for (const roleName of ['ADMIN', 'TEACHER', 'ACCOUNTANT'])
            await rejects(() => control.preview(scope('RESET', [b.id]), roleName, 0), 403); await rejects(() => control.preview(scope('RESET', [b.id]), 'SUPER_ADMIN', 2), 401); await db.user.update({ where: { id: 'SUPER_ADMIN' }, data: { status: 'INACTIVE' } }); await rejects(() => control.preview(scope('RESET', [b.id]), 'SUPER_ADMIN', 0), 403); await db.user.update({ where: { id: 'SUPER_ADMIN' }, data: { status: 'ACTIVE' } }); });
        await check('restricted runtime cannot delete directly, forge GUC, read signing secret or forge signature', async () => { await rejects(() => db.$executeRawUnsafe('DELETE FROM "AttendanceSession" WHERE id=$1', b.id)); await rejects(() => db.$executeRawUnsafe('DELETE FROM "Attendance" WHERE "sessionId"=$1', other.id)); await rejects(() => db.$queryRawUnsafe('SELECT secret FROM azm_control_private.signing_key')); await rejects(() => db.$transaction(async (tx: any) => { await tx.$queryRawUnsafe("SELECT set_config('azm.exam_control_operation','forged',true)"); await tx.$executeRawUnsafe('UPDATE "ExamPlacementControl" SET frozen=true'); })); await rejects(() => db.$queryRawUnsafe('SELECT azm_execute_exam_control($1,$2)', '{}', 'forged')); });
        await check('legacy unscoped marks and unrelated centers survive full-lineage delete/recreate', async () => { await db.attendance.create({ data: { studentId: 'a1', status: 'PRESENT', method: 'MANUAL', markedByUserId: 'ADMIN' } }); const result: any = await act('DELETE', [a.id], { entireLineage: true, clearAllocations: true }); assert.equal(await db.attendance.count({ where: { sessionId: null, studentId: 'a1' } }), 1); assert.equal(result.replacements[0].status, 'PRE_OPEN'); assert.deepEqual(await attendance.getSession(other.id), otherBefore); assert.equal((await db.student.findUnique({ where: { id: 'a1' } })).qrToken, identityBefore.qrToken); a = (await attendance.getSession(result.replacements[0].newSessionId)).session; });
        await check('durable generation never reuses a deleted generation', async () => { assert(a.attemptNumber >= 4); const prior = a.attemptNumber; const result: any = await act('DELETE', [a.id], { entireLineage: true }); a = (await attendance.getSession(result.replacements[0].newSessionId)).session; assert.equal(a.attemptNumber, prior + 1); });
        await check('legacy ambiguous results block reset, evidence mapping establishes ownership, new unowned writes reject', async () => {
            await db.student.update({ where: { id: 'legacy' }, data: { assignedHallId: 'a', seatNo: 'Seat #99' } });
            await rejects(() => control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0), 409);
            await rejects(() => db.student.update({ where: { id: 'legacy' }, data: { testScore: 78 } }));
            await openHall('a');
            a = (await attendance.getSession(a.id)).session;
            await act('MAP_RESULTS', [a.id], { resultStudentIds: ['legacy'], ownershipEvidence: 'Synthetic verified score sheet for this exact exam' });
            assert.equal((await db.student.findUnique({ where: { id: 'legacy' } })).resultSessionId, a.id);
            const p = await control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0);
            assert.equal(p.totals.linkedResults, 1);
            const result: any = await confirm(p);
            assert.equal(result.deletedResults, 1);
            assert.equal((await db.student.findUnique({ where: { id: 'legacy' } })).testScore, null);
            a = (await attendance.getSession(result.replacements[0].newSessionId)).session;
        });
        await check('reset affected sessions and move is atomic and leaves replacement and destination PRE_OPEN', async () => {
            b = (await openHall('b')).session;
            await mark(b, 'a2');
            const p = await control.preview(scope('RESET', [b.id], { moveStudentId: 'a2', destinationHallId: 'a' }), 'SUPER_ADMIN', 0);
            assert.equal(p.move.studentId, 'a2');
            const result: any = await confirm(p);
            assert.equal(result.movedStudentId, 'a2');
            assert.equal((await db.student.findUnique({ where: { id: 'a2' } })).assignedHallId, 'a');
            assert.equal((await attendance.getSession(a.id)).session.status, 'PRE_OPEN');
            b = (await attendance.getSession(result.replacements[0].newSessionId)).session;
            assert.equal(b.status, 'PRE_OPEN');
        });
        await check('audit receipts cannot be edited or erased', async () => { await rejects(() => db.$executeRawUnsafe('DELETE FROM "ExamControlOperation"')); await assert.rejects(() => admin!.query('UPDATE "ExamControlOperation" SET reason=\'tampered\''), /immutable/); });
        await check('duplicate concurrent confirmations create one replacement and receipt', async () => { const p = await control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0), key = randomUUID(); const [x, y]: any = await Promise.all([confirm(p, key), confirm(p, key)]); assert.equal(x.operationId, y.operationId); assert.equal(await db.examControlOperation.count({ where: { idempotencyKey: key } }), 1); a = (await attendance.getSession(x.replacements[0].newSessionId)).session; });
        await check('operation rollback retains original session when receipt insert fails', async () => { await admin!.query(`ALTER TABLE "ExamControlOperation" ADD CONSTRAINT fixture_failure CHECK(reason<>'Rollback fixture reason') NOT VALID`); const p = await control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0); await rejects(() => confirm(p, randomUUID(), 'Rollback fixture reason')); await admin!.query('ALTER TABLE "ExamControlOperation" DROP CONSTRAINT fixture_failure'); assert(await db.attendanceSession.findUnique({ where: { id: a.id } })); });
        await check('scope-bound and action-specific confirmations reject altered center/date/action', async () => { const p = await control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0); await rejects(() => control.confirm({ challenge: p.challenge, reason: 'Synthetic wrong phrase', confirmationText: 'DELETE A 2026-11-15' }, 'SUPER_ADMIN', 0, randomUUID()), 400); await rejects(() => control.preview(scope('RESET', [other.id]), 'SUPER_ADMIN', 0), 409); });
        await check('production runtime guard accepts signed capability and rejects a mismatched signing key', async () => {
            const { assertRestrictedRuntimeDatabase } = await import('../src/security/dbRuntimeSafety');
            await assertRestrictedRuntimeDatabase(db, { databaseUrl: url.toString(), directUrl: url.toString() });
            process.env.EXAM_CONTROL_SIGNING_KEY = 'wrong-'.repeat(15);
            await rejects(() => assertRestrictedRuntimeDatabase(db, { databaseUrl: url.toString(), directUrl: url.toString() }));
            process.env.EXAM_CONTROL_SIGNING_KEY = signingKey;
        });
        await check('open/reset race yields one coherent current attempt and no copied stale roster', async () => {
            const p = await control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0);
            await Promise.allSettled([openHall('a'), confirm(p)]);
            const current = await db.attendanceSession.findMany({ where: { examHallId: 'a', businessDate: new Date('2026-11-15'), isCurrent: true } });
            assert.equal(current.length, 1);
            a = current[0];
            if (a.status === 'PRE_OPEN')
                assert.equal(await db.attendanceSessionCandidate.count({ where: { sessionId: a.id } }), 0);
        });
        await check('scan/reset race never redirects an old scan into the replacement', async () => {
            if (a.status === 'PRE_OPEN')
                a = (await openHall('a')).session;
            const student = (await attendance.getSession(a.id)).roster[0];
            const p = await control.preview(scope('RESET', [a.id]), 'SUPER_ADMIN', 0), oldId = a.id;
            await Promise.allSettled([attendance.mark(oldId, { studentId: student.studentId, status: 'PRESENT', revision: a.revision }, 'TEACHER'), confirm(p)]);
            a = await db.attendanceSession.findFirst({ where: { examHallId: 'a', isCurrent: true, businessDate: new Date('2026-11-15') } });
            if (a.id !== oldId) {
                assert.equal(a.status, 'PRE_OPEN');
                assert.equal(await db.attendance.count({ where: { sessionId: a.id } }), 0);
            }
            else
                assert.equal(await db.attendance.count({ where: { sessionId: oldId } }), 1);
        });
        await check('freeze/move race serializes placement and ends with an explicit freeze', async () => {
            const p = await control.preview(scope('FREEZE'), 'SUPER_ADMIN', 0);
            await Promise.allSettled([confirm(p), halls.updateStudentAllocation('b1', { seatNo: 'Seat #09' })]);
            if (!(await control.current('A', '2026-11-15')).placement.frozen)
                await act('FREEZE');
            await rejects(() => halls.updateStudentAllocation('b1', { seatNo: 'Seat #10' }));
            await act('UNFREEZE');
        });
        await check('student fees/documents and separately owned examination scores remain intact', async () => {
            assert.deepEqual(await db.feeRecord.findUnique({ where: { id: fee.id } }), fee);
            assert.deepEqual(await db.studentDocument.findUnique({ where: { id: document.id } }), document);
            assert.equal((await db.student.findUnique({ where: { id: 'o1' } })).testScore, 88);
        });
        await check('historical-only deletion preserves retained current attempt and allocation', async () => {
            const p = await cancellation.preview(other.id, { purgeAttendance: false }, 'SUPER_ADMIN', 0);
            await cancellation.confirm(other.id, { challenge: p.challenge, reason: 'Synthetic historical cancellation', confirmationText: 'CANCEL SESSION' }, 'SUPER_ADMIN', randomUUID(), 0);
            const current = await control.prepare('other', 'SUPER_ADMIN', 0);
            const before = await db.student.findUnique({ where: { id: 'o1' } });
            await rejects(() => control.preview(scope('DELETE', [other.id], { testCenterId: 'B' }), 'SUPER_ADMIN', 0), 409);
            const deletion = await control.preview(scope('DELETE', [other.id], { testCenterId: 'B', replace: false }), 'SUPER_ADMIN', 0);
            const result: any = await confirm(deletion);
            assert.equal(result.replacements.length, 0);
            assert(await db.attendanceSession.findUnique({ where: { id: current.id } }));
            assert.equal((await db.student.findUnique({ where: { id: 'o1' } })).assignedHallId, before.assignedHallId);
            assert.equal(await db.attendanceSessionCancellation.count({ where: { sessionId: other.id } }), 1);
            other = current;
        });
        await check('entire lineage lists CANCELLED and current attempts then removes both and keeps audit identifiers', async () => {
            await openHall('other');
            const old = other.id;
            const p = await cancellation.preview(old, { purgeAttendance: false }, 'SUPER_ADMIN', 0);
            await cancellation.confirm(old, { challenge: p.challenge, reason: 'Synthetic lineage cancellation', confirmationText: 'CANCEL SESSION' }, 'SUPER_ADMIN', randomUUID(), 0);
            const current = await control.prepare('other', 'SUPER_ADMIN', 0);
            const review = await control.preview(scope('DELETE', [old], { testCenterId: 'B', entireLineage: true, clearAllocations: true }), 'SUPER_ADMIN', 0);
            assert.equal(review.attempts.length, 2);
            assert(review.attempts.some((s: any) => s.status === 'CANCELLED'));
            const result: any = await confirm(review);
            assert.equal(result.replacements.length, 1);
            assert.equal(await db.attendanceSession.count({ where: { id: { in: [old, current.id] } } }), 0);
            assert.equal(await db.attendanceSessionCancellation.count({ where: { sessionId: old } }), 1);
            assert.equal((await db.student.findUnique({ where: { id: 'o1' } })).assignedHallId, null);
        });
        await check('database rejects an expired signed capability under a non-UTC database timezone', async () => {
            const payload = JSON.stringify({ actorId: 'SUPER_ADMIN', tokenVersion: 0, idempotencyKey: randomUUID(), requestHash: 'a'.repeat(64), expiresAt: new Date(Date.now() - 60000).toISOString(), reason: 'Expired synthetic capability', action: 'FREEZE', testCenterId: 'A', businessDate: '2026-11-15', sessionIds: [], operationId: randomUUID(), nonce: randomUUID(), scope: {} });
            await rejects(() => db.$queryRawUnsafe('SELECT azm_execute_exam_control($1,$2)', payload, createHmac('sha256', signingKey).update(payload).digest('hex')));
        });
        await check('activity history includes lifecycle and deletion receipts with UTC timestamps and date-only scope', async () => {
            const history = await control.history('SUPER_ADMIN', 0, 'A', '2026-11-15');
            assert(history.some((event: any) => event.action === 'OPEN'));
            assert(history.some((event: any) => event.action === 'RESET'));
            assert(history.every((event: any) => event.scope.businessDate === '2026-11-15' && Math.abs(new Date(event.completedAt).getTime() - Date.now()) < 600000));
        });
        const reviewFixture = async (id: string, date: string, capacity = 150) => {
            await db.testCenter.create({ data: { id, name: 'Review ' + id, code: id, address: 'Synthetic', district: 'Synthetic', testDate: date } });
            for (const suffix of ['source', 'destination'])
                await db.examHall.create({ data: { id: id + '-' + suffix, name: id + ' ' + suffix, roomNumber: suffix, targetClass: 'Class 9th', examDate: date, reportingTime: '09:00 AM', testCenterId: id, capacity } });
            return { center: id, source: id + '-source', destination: id + '-destination', date };
        };
        await check('supported English date aliases cannot bypass a center freeze', async () => {
            const f = await reviewFixture('review-dates', '2026-11-15');
            for (const text of ['2026-11-15', '15 November 2026', '15 Nov 2026', 'Sunday, 15 NOV 2026']) {
                const rows = await db.$queryRawUnsafe('SELECT to_char(azm_business_date($1),\'YYYY-MM-DD\') AS value', text);
                assert.equal(rows[0].value, f.date);
            }
            assert.equal((await db.$queryRawUnsafe('SELECT azm_business_date($1) AS value', '31 Nov 2026'))[0].value, null);
            await act('FREEZE', [], { testCenterId: f.center, businessDate: f.date });
            for (const examDate of ['15 Nov 2026', 'Sunday, 15 NOV 2026', '31 Nov 2026'])
                await rejects(() => db.examHall.create({ data: { id: randomUUID(), name: 'Alias', roomNumber: 'alias', targetClass: 'Class 9th', examDate, reportingTime: '09:00 AM', testCenterId: f.center } }));
        });
        await check('completed earlier-date evidence survives allocation for a later examination', async () => {
            const f = await reviewFixture('review-history', '2026-11-20');
            await db.student.create({ data: candidate('history-student', f.source, 'Seat #01') });
            await control.prepare(f.source, 'ADMIN', 0);
            const old = (await openHall(f.source)).session;
            await mark(old, 'history-student');
            await db.student.update({ where: { id: 'history-student' }, data: { testScore: 91, resultSessionId: old.id } });
            await attendance.closeSession(old.id, false, 'ADMIN');
            const before = await attendance.getSession(old.id);
            await rejects(() => halls.updateStudentAllocation('history-student', { assignedHallId: f.destination }));
            await db.examHall.update({ where: { id: f.destination }, data: { examDate: '2026-11-21' } });
            await halls.updateStudentAllocation('history-student', { assignedHallId: f.destination });
            assert.deepEqual(await attendance.getSession(old.id), before);
            const student = await db.student.findUnique({ where: { id: 'history-student' } });
            assert.equal(student.testScore, 91);
            assert.equal(student.resultSessionId, old.id);
            await db.examHall.update({ where: { id: f.source }, data: { examDate: '2026-11-21' } });
            await db.student.update({ where: { id: 'legacy-newer-exam' }, data: { assignedHallId: f.source, seatNo: 'Seat #01' } });
            for (const action of ['RESET', 'DELETE'])
                await rejects(() => control.preview(scope(action, [old.id], { testCenterId: f.center, businessDate: f.date }), 'SUPER_ADMIN', 0), 409);
            const p = await control.preview(scope('DELETE', [old.id], { testCenterId: f.center, businessDate: f.date, replace: false, clearAllocations: true }), 'SUPER_ADMIN', 0);
            assert.equal(p.totals.linkedResults, 1);
            const result: any = await confirm(p);
            assert.equal(result.deletedResults, 1);
            assert.equal(result.replacements.length, 0);
            assert.equal((await db.student.findUnique({ where: { id: 'history-student' } })).assignedHallId, f.destination);
            const unrelated = await db.student.findUnique({ where: { id: 'legacy-newer-exam' } });
            assert.equal(unrelated.testScore, 77);
            assert.equal(unrelated.resultSessionId, null);
            assert.equal(unrelated.assignedHallId, f.source);
        });
        await check('historical Hall attempts retain their center scope until explicitly deleted', async () => {
            const f = await reviewFixture('review-center', '2026-11-22');
            await db.student.create({ data: candidate('center-student', f.source, 'Seat #01') });
            await control.prepare(f.source, 'ADMIN', 0);
            const session = (await openHall(f.source)).session;
            await attendance.closeSession(session.id, false, 'ADMIN');
            await rejects(() => db.examHall.update({ where: { id: f.source }, data: { testCenterId: 'B' } }));
            const historyBefore = await control.history('SUPER_ADMIN', 0, f.center, f.date);
            await act('DELETE', [session.id], { testCenterId: f.center, businessDate: f.date, entireLineage: true, replace: false });
            await db.examHall.update({ where: { id: f.source }, data: { testCenterId: 'B' } });
            const historyAfter = await control.history('SUPER_ADMIN', 0, f.center, f.date);
            for (const event of historyBefore)
                assert.deepEqual(historyAfter.find((row: any) => row.id === event.id), event);
        });
        await check('expanded full-lineage preview counts results from every selected generation', async () => {
            const f = await reviewFixture('review-lineage', '2026-11-23');
            await db.student.create({ data: candidate('lineage-student', f.source, 'Seat #01') });
            await control.prepare(f.source, 'ADMIN', 0);
            const old = (await openHall(f.source)).session;
            const cancel = await cancellation.preview(old.id, { purgeAttendance: false }, 'SUPER_ADMIN', 0);
            await cancellation.confirm(old.id, { challenge: cancel.challenge, reason: 'Synthetic lineage result review', confirmationText: 'CANCEL SESSION' }, 'SUPER_ADMIN', randomUUID(), 0);
            await control.prepare(f.source, 'ADMIN', 0);
            const current = (await openHall(f.source)).session;
            await db.student.update({ where: { id: 'lineage-student' }, data: { testScore: 92, resultSessionId: current.id } });
            const p = await control.preview(scope('DELETE', [old.id], { testCenterId: f.center, businessDate: f.date, entireLineage: true }), 'SUPER_ADMIN', 0);
            assert.equal(p.attempts.length, 2);
            assert.equal(p.totals.linkedResults, 1);
            const result: any = await confirm(p);
            assert.equal(result.deletedResults, p.totals.linkedResults);
            assert.equal((await db.student.findUnique({ where: { id: 'lineage-student' } })).testScore, null);
        });
        await check('owned results count as progress before moving an unmarked OPEN student', async () => {
            const f = await reviewFixture('review-score', '2026-11-24');
            const target = await reviewFixture('review-score-target', f.date);
            await db.student.create({ data: candidate('score-student', f.source, 'Seat #01') });
            await control.prepare(f.source, 'ADMIN', 0);
            const session = (await openHall(f.source)).session;
            await db.student.update({ where: { id: 'score-student' }, data: { testScore: 93, resultSessionId: session.id } });
            await rejects(() => halls.updateStudentAllocation('score-student', { assignedHallId: f.destination }));
            assert.equal((await attendance.getSession(session.id)).roster.length, 1);
            await act('FREEZE', [], { testCenterId: f.center, businessDate: f.date });
            await rejects(() => control.preview(scope('RESET', [session.id], { testCenterId: f.center, businessDate: f.date, moveStudentId: 'score-student', destinationHallId: target.source }), 'SUPER_ADMIN', 0), 409);
            const result: any = await act('RESET', [session.id], { testCenterId: f.center, businessDate: f.date, moveStudentId: 'score-student', destinationHallId: target.source, unfreeze: true });
            assert.equal(result.deletedResults, 1);
            assert.equal((await db.student.findUnique({ where: { id: 'score-student' } })).assignedHallId, target.source);
        });
        await check('reset-and-move allocates Seat #100 when the first 99 seats are occupied', async () => {
            const f = await reviewFixture('review-seat100', '2026-11-25', 100);
            await db.student.createMany({ data: Array.from({ length: 99 }, (_, i) => candidate('seat100-' + i, f.destination, 'Seat #' + String(i + 1).padStart(2, '0'))) });
            await db.student.create({ data: candidate('seat100-moving', f.source, 'Seat #01') });
            await control.prepare(f.source, 'ADMIN', 0);
            const session = (await openHall(f.source)).session;
            await mark(session, 'seat100-moving');
            const result: any = await act('RESET', [session.id], { testCenterId: f.center, businessDate: f.date, moveStudentId: 'seat100-moving', destinationHallId: f.destination });
            assert.equal(result.movedStudentId, 'seat100-moving');
            assert.equal((await db.student.findUnique({ where: { id: 'seat100-moving' } })).seatNo, 'Seat #100');
        });
        await check('verified legacy result ownership may be mapped to actual cancelled roster evidence', async () => {
            const f = await reviewFixture('review-legacy-history', '2026-11-26');
            await db.student.update({ where: { id: 'legacy-archived' }, data: { assignedHallId: f.source, seatNo: 'Seat #01' } });
            await control.prepare(f.source, 'ADMIN', 0);
            const old = (await openHall(f.source)).session;
            const cancel = await cancellation.preview(old.id, { purgeAttendance: false }, 'SUPER_ADMIN', 0);
            await cancellation.confirm(old.id, { challenge: cancel.challenge, reason: 'Synthetic historical result mapping', confirmationText: 'CANCEL SESSION' }, 'SUPER_ADMIN', randomUUID(), 0);
            const current = await control.prepare(f.source, 'ADMIN', 0);
            await rejects(() => db.student.update({ where: { id: 'legacy-archived' }, data: { resultSessionId: old.id } }));
            const view = await control.current(f.center, f.date);
            assert(view.legacyResults.find((student: any) => student.id === 'legacy-archived')?.sessionIds.includes(old.id));
            await act('MAP_RESULTS', [old.id], { testCenterId: f.center, businessDate: f.date, resultStudentIds: ['legacy-archived'], ownershipEvidence: 'Synthetic archived score sheet identifies this exact attempt' });
            assert.equal((await db.student.findUnique({ where: { id: 'legacy-archived' } })).testScore, 77);
            assert.equal((await db.student.findUnique({ where: { id: 'legacy-archived' } })).resultSessionId, old.id);
            await rejects(() => db.student.update({ where: { id: 'legacy-archived' }, data: { testScore: 78 } }));
            const deleted: any = await act('DELETE', [old.id], { testCenterId: f.center, businessDate: f.date, replace: false });
            assert.equal(deleted.deletedResults, 1);
            assert(await db.attendanceSession.findUnique({ where: { id: current.id } }));
        });
        await check('a stale Open request cannot open the replacement PRE_OPEN attempt', async () => {
            const f = await reviewFixture('review-open', '2026-11-27');
            await db.student.create({ data: candidate('open-student', f.source, 'Seat #01') });
            const old = await control.prepare(f.source, 'ADMIN', 0);
            const result: any = await act('RESET', [old.id], { testCenterId: f.center, businessDate: f.date });
            await rejects(() => attendance.openSession(f.source, 'ADMIN', { sessionId: old.id, revision: old.revision }), 409);
            const fresh = await db.attendanceSession.findUnique({ where: { id: result.replacements[0].newSessionId } });
            assert.equal(fresh.status, 'PRE_OPEN');
            assert.equal(await db.attendanceSessionCandidate.count({ where: { sessionId: fresh.id } }), 0);
            assert.equal((await openHall(f.source)).session.id, fresh.id);
        });
        await check('clearing an old allocation preserves a newer OfficeUse placement tuple', async () => {
            const f = await reviewFixture('review-office', '2026-11-29');
            await db.student.create({ data: candidate('office-student', f.source, 'Seat #01') });
            const old = await control.prepare(f.source, 'ADMIN', 0);
            const mirror = await db.officeUseRecord.create({ data: { studentId: 'office-student', testCentre: 'Review ' + f.center, testDate: new Date('2026-11-30'), testReportingTime: '09:00 AM' } });
            const reset: any = await act('RESET', [old.id], { testCenterId: f.center, businessDate: f.date, clearAllocations: true });
            assert.equal(reset.clearedAllocations, 1);
            assert.deepEqual(await db.officeUseRecord.findUnique({ where: { studentId: 'office-student' } }), mirror);
            await halls.updateStudentAllocation('office-student', { assignedHallId: f.source });
            const aligned = await db.officeUseRecord.findUnique({ where: { studentId: 'office-student' } });
            assert.equal(aligned.testDate.toISOString().slice(0, 10), f.date);
            await act('RESET', [reset.replacements[0].newSessionId], { testCenterId: f.center, businessDate: f.date, clearAllocations: true });
            const cleared = await db.officeUseRecord.findUnique({ where: { studentId: 'office-student' } });
            assert.equal(cleared.testCentre, null);
            assert.equal(cleared.testDate, null);
            assert.equal(cleared.testReportingTime, null);
        });
        await check('direct student insertion into an editable OPEN Hall synchronizes its roster and revision', async () => {
            const f = await reviewFixture('review-insert', '2026-11-30', 2);
            await db.student.create({ data: candidate('insert-first', f.source, 'Seat #01') });
            await control.prepare(f.source, 'ADMIN', 0);
            const opened = (await openHall(f.source)).session;
            await db.student.create({ data: candidate('insert-second', f.source, 'Seat #02') });
            const detail = await attendance.getSession(opened.id);
            assert.equal(detail.roster.length, 2);
            assert(detail.session.revision > opened.revision);
            await rejects(() => db.student.create({ data: candidate('insert-duplicate', f.source, 'Seat #01') }));
            await rejects(() => db.student.create({ data: candidate('insert-capacity', f.source, 'Seat #03') }));
            await rejects(() => db.student.create({ data: { ...candidate('insert-inactive', f.destination, 'Seat #01'), status: 'INACTIVE' } }));
            assert.equal((await attendance.getSession(opened.id)).roster.length, 2);
        });
        await check('reopening a prior examination cannot duplicate a student currently OPEN on another date', async () => {
            const f = await reviewFixture('review-exclusive', '2026-12-01');
            await db.student.create({ data: candidate('exclusive-student', f.source, 'Seat #01') });
            await control.prepare(f.source, 'ADMIN', 0);
            const old = (await openHall(f.source)).session;
            await mark(old, 'exclusive-student');
            await attendance.closeSession(old.id, false, 'ADMIN');
            await db.examHall.update({ where: { id: f.destination }, data: { examDate: '2026-12-02' } });
            await halls.updateStudentAllocation('exclusive-student', { assignedHallId: f.destination });
            await control.prepare(f.destination, 'ADMIN', 0);
            const next = (await openHall(f.destination)).session;
            await rejects(() => attendance.reopenSession(old.id, 'Synthetic cross-date conflict review', 'SUPER_ADMIN', 0), 409);
            assert.equal((await attendance.getSession(old.id)).session.status, 'CLOSED');
            assert.equal((await attendance.getSession(next.id)).session.status, 'OPEN');
        });
        await check('receipt lookup sees a confirmation committed while it was waiting for the shared lock', async () => {
            const f = await reviewFixture('review-receipt', '2026-11-28');
            const p = await control.preview(scope('FREEZE', [], { testCenterId: f.center, businessDate: f.date }), 'SUPER_ADMIN', 0);
            const signed = JSON.parse(Buffer.from(p.challenge.split('.')[0], 'base64url').toString());
            const idempotencyKey = randomUUID();
            const payload = JSON.stringify({ ...signed.scope, scope: signed.scope, actorId: 'SUPER_ADMIN', tokenVersion: 0, idempotencyKey, requestHash: 'a'.repeat(64), reason: 'Synthetic delayed receipt confirmation', nonce: signed.nonce, expiresAt: signed.expiresAt, operationId: randomUUID() });
            await admin!.query('BEGIN');
            try {
                await admin!.query('SELECT pg_advisory_xact_lock(73921,19)');
                const lookup = control.operation('SUPER_ADMIN', 0, idempotencyKey, p.challenge);
                void lookup.catch(() => {});
                let waiting = false;
                for (let attempt = 0; attempt < 200; attempt++) {
                    const result = await owner.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event=$2', [database, 'advisory']);
                    if (result.rowCount) { waiting = true; break; }
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                assert(waiting, 'Receipt request must be waiting behind the original transaction');
                const committed = (await admin!.query('SELECT azm_execute_exam_control($1,$2) AS result', [payload, createHmac('sha256', signingKey).update(payload).digest('hex')])).rows[0].result;
                await admin!.query('COMMIT');
                assert.deepEqual(await lookup, committed);
            } catch (error) {
                await admin!.query('ROLLBACK');
                throw error;
            }
        });
        await check('missing receipt stays pending until the exact signed review safely expires', async () => {
            const p = await control.preview(scope('FREEZE'), 'SUPER_ADMIN', 0);
            const key = randomUUID();
            assert.deepEqual(await control.operation('SUPER_ADMIN', 0, key, p.challenge), { status: 'NOT_FOUND', terminal: false });
            const decoded = JSON.parse(Buffer.from(p.challenge.split('.')[0], 'base64url').toString());
            decoded.expiresAt = new Date(Date.now() - 60000).toISOString();
            const payload = JSON.stringify(decoded);
            const expired = Buffer.from(payload).toString('base64url') + '.' + createHmac('sha256', signingKey).update(payload).digest('hex');
            const result: any = await control.operation('SUPER_ADMIN', 0, key, expired);
            assert.equal(result.status, 'EXPIRED');
            assert.equal(result.terminal, true);
            await rejects(() => control.confirm({ challenge: expired, reason: 'Synthetic delayed expired confirmation', confirmationText: p.phrase }, 'SUPER_ADMIN', 0, key), 410);
            assert.equal((await control.operation('SUPER_ADMIN', 0, idem, expired) as any).operationId, reset.operationId);
        });
        if (process.env.EXAM_CONTROL_BROWSER === 'true') {
            const { verifyExamControlUI } = await import('./exam-session-control-ui');
            await verifyExamControlUI();
        }
        console.log(`PASS ${passed} exam session control integration checks`);
    }
    finally {
        await db?.$disconnect();
        try {
            shared = await import('../src/lib/prisma');
            await shared.prisma.$disconnect();
        }
        catch { }
        await admin?.end();
        await owner.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [database]);
        await owner.query(`DROP DATABASE IF EXISTS "${database}"`);
        await owner.query(`DROP ROLE IF EXISTS "${role}"`);
        await owner.query(`DROP ROLE IF EXISTS "${capabilityOwner}"`);
        await owner.end();
    }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
