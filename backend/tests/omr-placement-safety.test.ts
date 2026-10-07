import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
process.env.JWT_ACCESS_SECRET = 'placement-safety-test-access-secret-only';
process.env.JWT_REFRESH_SECRET = 'placement-safety-test-refresh-secret-only';
process.env.QR_SECRET = 'placement-safety-test-qr-secret-only';
process.env.R2_BUCKET = 'placement-safety-test-bucket';
process.env.R2_ACCOUNT_ID = 'placement-safety-test-account';
process.env.R2_ACCESS_KEY_ID = 'placement-safety-test-access-key';
process.env.R2_SECRET_ACCESS_KEY = 'placement-safety-test-secret-key';

let checks = 0;
function check(fn: () => void) {
  fn();
  checks++;
}

function omr(student: any) {
  return pdfService.generateOmrSheetHtml(student);
}

function methodSource(source: string, name: string) {
  source = source.replace(/\r\n/g, '\n');
  const start = source.indexOf(`  ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const next = source.indexOf('\n  generate', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

let pdfService: any;

async function run() {
  const [{ pdfService: service }, { getExamScheduleForStudent }] = await Promise.all([
    import('../src/modules/documents/pdf.service'),
    import('../src/modules/students/students.service'),
  ]);
  pdfService = service;

  const rawStudent = {
    id: 'omr-candidate-1', applicationNo: 'APP-OMR-1', rollNumber: 'AZMVS-101',
    fullName: 'OMR Candidate', fatherName: 'Parent', currentClass: 'Class 10th', seatNo: 'STALE SEAT',
    assignedHall: 'STALE LEGACY VENUE', assignedRoom: 'STALE ROOM', testCenterName: 'STALE CENTER',
    testDate: 'STALE DATE', reportingTime: 'STALE TIME', examDate: 'STALE EXAM DATE',
    officeUse: { testCentre: 'STALE LEGACY VENUE', testDate: '2040-12-31', testReportingTime: 'STALE OFFICE TIME' },
  };
  const pending = getExamScheduleForStudent({ ...rawStudent, assignedHallId: null }, null);
  const pendingHtml = omr({ ...rawStudent, ...pending });
  check(() => {
    assert.match(pendingHtml, /To be assigned/);
    assert.match(pendingHtml, /To be announced/);
    for (const stale of ['STALE LEGACY VENUE', 'STALE ROOM', 'STALE SEAT', 'STALE CENTER', 'STALE DATE', 'STALE TIME', '2040-12-31', 'STALE OFFICE TIME']) {
      assert.equal(pendingHtml.includes(stale), false, `${stale} is suppressed`);
    }
  });

  const hall = {
    id: 'hall-1', name: 'Hall North', roomNumber: 'Room N-2',
    examDate: 'Sunday, 15 November 2026', reportingTime: '08:15 AM',
    testCenterId: 'center-1', testCenter: { id: 'center-1', name: 'Abbottabad Examination Center', address: 'Main Road' },
  };
  const assigned = getExamScheduleForStudent({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014' }, hall);
  const assignedHtml = omr({ ...rawStudent, ...assigned });
  check(() => {
    for (const value of ['Abbottabad Examination Center', 'Hall North', 'Room N-2', 'B-014', 'Sunday, 15 November 2026', '08:15 AM']) {
      assert.ok(assignedHtml.includes(value), `verified placement renders ${value}`);
    }
    assert.equal(assignedHtml.includes('STALE LEGACY VENUE'), false, 'verified Hall center takes precedence over legacy office text');
  });

  const noCenter = getExamScheduleForStudent({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014' }, {
    ...hall, testCenter: null,
  });
  check(() => {
    const html = omr({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014', ...noCenter });
    assert.equal(noCenter.placementStatus, 'ASSIGNED');
    assert.ok(html.includes('Hall North'));
    assert.ok(html.includes('To be assigned'));
    assert.ok(html.includes('Sunday, 15 November 2026'));
    assert.ok(html.includes('08:15 AM'));
  });

  const orphanCenter = getExamScheduleForStudent({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014' }, {
    ...hall, testCenter: { ...hall.testCenter, id: 'other-center' },
  });
  check(() => {
    assert.equal(orphanCenter.placementStatus, 'ASSIGNED');
    assert.equal(orphanCenter.testCenterName, null);
    assert.equal(orphanCenter.testCenterAddress, null);
    assert.ok(omr({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014', ...orphanCenter }).includes('Hall North'));
  });

  const mismatchedHall = getExamScheduleForStudent({ ...rawStudent, assignedHallId: 'deleted-hall' }, hall);
  check(() => {
    assert.equal(mismatchedHall.placementStatus, 'PLACEMENT_PENDING');
    assert.equal(mismatchedHall.assignedHallId, null);
    assert.ok(omr({ ...rawStudent, assignedHallId: 'deleted-hall', ...mismatchedHall }).includes('To be assigned'));
  });

  const validDateAndTime = getExamScheduleForStudent({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014' }, hall);
  check(() => {
    assert.equal(validDateAndTime.testDate, 'Sunday, 15 November 2026');
    assert.equal(validDateAndTime.reportingTime, '08:15 AM');
    const html = omr({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014', ...validDateAndTime });
    assert.ok(html.includes('Sunday, 15 November 2026'));
    assert.ok(html.includes('08:15 AM'));
    const missingSchedule = getExamScheduleForStudent({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014' }, {
      ...hall, examDate: null, reportingTime: null,
    });
    const missingScheduleHtml = omr({ ...rawStudent, assignedHallId: 'hall-1', seatNo: 'B-014', ...missingSchedule });
    assert.ok(missingScheduleHtml.includes('To be announced'));
    assert.equal(missingScheduleHtml.includes('2040-12-31'), false);
    assert.equal(missingScheduleHtml.includes('STALE OFFICE TIME'), false);
  });

  const invalidMarker = omr({ ...rawStudent, assignedHallId: 'hall-1', placementStatus: 'PLACEMENT_PENDING' });
  check(() => {
    assert.ok(invalidMarker.includes('To be assigned'));
    assert.ok(invalidMarker.includes('To be announced'));
    assert.equal(invalidMarker.includes('STALE LEGACY VENUE'), false);
  });

  const rawHallIdOnly = omr({ ...rawStudent, assignedHallId: 'hall-1', placementStatus: undefined });
  check(() => {
    assert.ok(rawHallIdOnly.includes('To be assigned'));
    assert.equal(rawHallIdOnly.includes('STALE LEGACY VENUE'), false);
  });

  const releaseConfig = {
    examCenterName: 'Invented release-config center', examDate: 'Invented release-config date',
    maleReportingTime: '12:00 PM', isScheduled: true,
  };
  check(() => {
    const html = omr({ ...rawStudent, ...pending, ...releaseConfig });
    for (const value of ['Invented release-config center', 'Invented release-config date', '12:00 PM']) {
      assert.equal(html.includes(value), false, `release config cannot supply ${value}`);
    }
  });

  // The OMR change must not alter the registration and roll-slip HTML implementations.
  const currentPdf = readFileSync('src/modules/documents/pdf.service.ts', 'utf8');
  const baselinePdf = execFileSync('git', ['show', '22b01494:backend/src/modules/documents/pdf.service.ts'], { encoding: 'utf8' });
  check(() => assert.equal(methodSource(currentPdf, 'generateStudentRegistrationHtml'), methodSource(baselinePdf, 'generateStudentRegistrationHtml')));
  check(() => assert.equal(methodSource(currentPdf, 'generateRollSlipHtml'), methodSource(baselinePdf, 'generateRollSlipHtml')));

  // The attendance-bearing students roster method is also unchanged from baseline.
  check(() => assert.equal(methodSource(currentPdf, 'generateStudentsListHtml'), methodSource(baselinePdf, 'generateStudentsListHtml')));

  assert.equal(checks, 12, 'expected logical check count');
  console.log(`PASS: OMR placement safety (${checks} logical checks)`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
