import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
async function run() {
  if (!process.env.RELEASE_TIME_CHILD) {
    for (const TZ of ['UTC', 'Asia/Karachi', 'America/Los_Angeles']) {
      const result = spawnSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), __filename], {
        env: { ...process.env, TZ, RELEASE_TIME_CHILD: '1' }, encoding: 'utf8', windowsHide: true });
      process.stdout.write(result.stdout); process.stderr.write(result.stderr); assert.equal(result.status, 0, TZ);
    }
    return;
  }
  Object.assign(process.env, { NODE_ENV: 'production', DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
    JWT_ACCESS_SECRET: 'release-time-test-access-secret-only', JWT_REFRESH_SECRET: 'release-time-test-refresh-secret-only',
    QR_SECRET: 'release-time-test-qr-secret-only', R2_BUCKET: 'test', R2_ACCOUNT_ID: 'test',
    R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test' });
  const backend = await import('../src/modules/students/students.service');
  const { prisma } = await import('../src/lib/prisma');
  // Execute the actual frontend pure helper block without loading unrelated browser services.
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/lib/mockApi.ts'), 'utf8');
  const block = source.slice(source.indexOf('// Release scheduling uses Pakistan'), source.indexOf('export interface RollNumberReleaseConfig'));
  const context: any = { exports: {}, module: { exports: {} } };
  vm.runInNewContext(transformSync(block, { loader: 'ts', format: 'cjs' }).code, context);
  const frontend = context.module?.exports || context.exports;
  let checks = 0;
  function check(fn: () => void) { fn(); checks++; }
  const canonical = '2026-10-25T04:00:00.000Z';
  for (const value of ['2026-10-25T09:00', canonical, '2026-10-25T09:00:00+05:00', '2026-10-25T09:00:00.000']) {
    check(() => assert.equal(backend.canonicalReleaseDateTime(value), canonical));
    check(() => assert.equal(frontend.canonicalReleaseDateTime(value), canonical));
  }
  const config = { isScheduled: true, releaseDateTime: '2026-10-25T09:00' };
  for (const [now, expected] of [[Date.parse(canonical) - 1000, false], [Date.parse(canonical), true]] as const) {
    check(() => assert.equal(backend.isReleaseConfigReleased(config, now), expected));
    check(() => assert.equal(frontend.isReleaseConfigReleased(config, now), expected));
  }
  check(() => assert.equal(frontend.releaseDateTimeToPakistanInput(canonical), '2026-10-25T09:00'));
  check(() => assert.equal(frontend.canonicalReleaseDateTime('2026-10-25T09:00'), canonical));
  check(() => assert.equal(backend.formatReleaseDateTime(canonical), 'Sunday, 25 October 2026 at 09:00 AM PKT'));
  check(() => assert.equal(frontend.formatReleaseDateTime(canonical), backend.formatReleaseDateTime(canonical)));
  for (const value of ['', 'garbage', '2026-02-30T09:00', '2026-10-25T25:00', '2026-10-25T09:00+05:99']) {
    check(() => {
      assert.equal(backend.isReleaseConfigReleased({ ...config, releaseDateTime: value }), false);
      assert.equal(frontend.isReleaseConfigReleased({ ...config, releaseDateTime: value }), false);
    });
  }
  let stored: any;
  const legacy = { ...config, announcementTitle: 'Immediate Release Active', announcementMessage: 'Scheduled notice',
    examCenterName: 'LEGACY', examDate: '2040-01-01', femaleReportingTime: '20:00' };
  (prisma.systemSetting as any).findUnique = async () => ({ value: JSON.stringify(legacy) });
  (prisma.systemSetting as any).upsert = async (input: any) => { stored = JSON.parse(input.update.value); };
  await backend.studentsService.getReleaseConfig();
  check(() => assert.equal(stored, undefined, 'GET never rewrites persisted config'));
  const saved = await backend.studentsService.saveReleaseConfig(legacy);
  check(() => { assert.equal(saved.releaseDateTime, canonical); assert.equal(stored.announcementTitle, legacy.announcementTitle); assert.equal(stored.examCenterName, 'LEGACY'); });
  await assert.rejects(backend.studentsService.saveReleaseConfig({ releaseDateTime: 'bad' }), (error: any) => error.statusCode === 400); checks++;
  (prisma.student as any).findFirst = async () => ({ id: 'test', fullName: 'Synthetic', applicationNo: 'APP-TEST',
    rollNumber: 'ISSUED', status: 'ACTIVE', feeRecords: [{ status: 'PAID' }] });
  const originalNow = Date.now;
  try {
    Date.now = () => Date.parse(canonical) - 1000;
    const result = await backend.studentsService.searchPublicSlip(undefined, '11111-2222222-3');
    check(() => { assert.equal(result.success, false); assert.match(result.error!, /09:00 AM PKT/); });
    Date.now = () => Date.parse(canonical);
    const atRelease = await backend.studentsService.searchPublicSlip(undefined, '11111-2222222-3');
    check(() => assert.equal(atRelease.code, 'PLACEMENT_PENDING', 'At release time the gate opens, but placement safety remains enforced'));
    (prisma.systemSetting as any).findUnique = async () => ({ value: JSON.stringify({ ...legacy, releaseDateTime: '' }) });
    const malformed = await backend.studentsService.searchPublicSlip(undefined, '11111-2222222-3');
    check(() => { assert.equal(malformed.success, false); assert.match(malformed.error!, /requires correction/); });
  } finally { Date.now = originalNow; }
  check(() => {
    const student = { assignedHallId: 'h', seatNo: 'S1', ...legacy };
    const hall = { id: 'h', name: 'Real Hall', roomNumber: 'R1', examDate: '2030-01-01', reportingTime: '08:00',
      testCenterId: 'c', testCenter: { id: 'c', name: 'Real Center' } };
    assert.deepEqual(backend.getExamScheduleForStudent(student, hall),
      backend.getExamScheduleForStudent({ ...student, examCenterName: 'CHANGED', examDate: '2099-01-01', femaleReportingTime: '01:00' }, hall));
  });
  console.log(`PASS: ${process.env.TZ}: ${checks} timezone/save/message/placement checks`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
