import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
process.env.JWT_ACCESS_SECRET = 'placement-safety-test-access-secret-only';
process.env.JWT_REFRESH_SECRET = 'placement-safety-test-refresh-secret-only';
process.env.QR_SECRET = 'placement-safety-test-qr-secret-only';
process.env.R2_BUCKET = 'placement-safety-test-bucket';
process.env.R2_ACCOUNT_ID = 'placement-safety-test-account';
process.env.R2_ACCESS_KEY_ID = 'placement-safety-test-access-key';
process.env.R2_SECRET_ACCESS_KEY = 'placement-safety-test-secret-key';

const assignedStudent = {
  id: 'student-1',
  assignedHallId: 'hall-1',
  seatNo: 'B-014',
  gender: 'NOT-A-SCHEDULE-INPUT',
  currentClass: 'Class 10th',
  status: 'INACTIVE',
  testCenterName: 'Invented center from student text',
  assignedRoom: 'Invented room from student text',
  examDate: 'Invented date from student text',
  reportingTime: 'Invented time from student text',
};

const linkedHall = {
  id: 'hall-1',
  name: 'Hall North',
  roomNumber: 'Room N-2',
  examDate: 'Sunday, 15 November 2026',
  reportingTime: '08:15 AM',
  testCenterId: 'center-1',
  testCenter: {
    id: 'center-1',
    name: 'Abbottabad Examination Center',
    address: 'Main Road, Abbottabad',
  },
};

function assertPendingPlacement(value: any, label: string) {
  assert.equal(value.placementStatus, 'PLACEMENT_PENDING', `${label}: pending status`);
  for (const key of [
    'assignedHallId', 'assignedHall', 'assignedRoom', 'seatNo', 'testCenterName',
    'testCenterAddress', 'testDate', 'reportingTime', 'examStartTime', 'testStartTime',
    'testEndTime', 'testTimeLabel', 'durationMinutes',
  ]) {
    assert.equal(value[key], null, `${label}: ${key} stays null`);
  }
}

async function run() {
  const { prisma } = await import('../src/lib/prisma');
  const {
    getExamScheduleForStudent,
    isRollSlipPlacementReady,
    studentsService,
  } = await import('../src/modules/students/students.service');

  // Placement is derived only from the matching assigned Hall and its linked center.
  const assigned = getExamScheduleForStudent(assignedStudent, linkedHall);
  assert.deepEqual(assigned, {
    placementStatus: 'ASSIGNED',
    assignedHallId: 'hall-1',
    assignedHall: 'Hall North',
    assignedRoom: 'Room N-2',
    seatNo: 'B-014',
    testCenterName: 'Abbottabad Examination Center',
    testCenterAddress: 'Main Road, Abbottabad',
    testDate: 'Sunday, 15 November 2026',
    reportingTime: '08:15 AM',
    examStartTime: null,
    testStartTime: null,
    testEndTime: null,
    testTimeLabel: null,
    durationMinutes: null,
  });
  assert.equal(isRollSlipPlacementReady(assigned), true);

  const noHall = getExamScheduleForStudent({ ...assignedStudent, assignedHallId: null }, null);
  assertPendingPlacement(noHall, 'no assigned Hall');

  const staleHall = getExamScheduleForStudent(
    { ...assignedStudent, assignedHallId: 'deleted-hall' },
    linkedHall,
  );
  assertPendingPlacement(staleHall, 'Hall ID mismatch');

  const linkedWithoutCenter = getExamScheduleForStudent(assignedStudent, {
    ...linkedHall,
    testCenter: null,
  });
  assert.equal(linkedWithoutCenter.placementStatus, 'ASSIGNED');
  assert.equal(linkedWithoutCenter.testCenterName, null);
  assert.equal(linkedWithoutCenter.testCenterAddress, null);
  assert.equal(isRollSlipPlacementReady(linkedWithoutCenter), true);

  const orphanCenter = getExamScheduleForStudent(assignedStudent, {
    ...linkedHall,
    testCenter: { ...linkedHall.testCenter, id: 'different-center' },
  });
  assert.equal(orphanCenter.placementStatus, 'ASSIGNED');
  assert.equal(orphanCenter.testCenterName, null);
  assert.equal(orphanCenter.testCenterAddress, null);

  for (const missingField of ['assignedRoom', 'seatNo', 'testDate', 'reportingTime']) {
    assert.equal(
      isRollSlipPlacementReady({ ...assigned, [missingField]: null }),
      false,
      `official slip is blocked when ${missingField} is absent`,
    );
  }
  assert.equal(isRollSlipPlacementReady({ ...assigned, placementStatus: 'PLACEMENT_PENDING' }), false);

  const originalFindFirst = prisma.student.findFirst;
  const originalFindHall = prisma.examHall.findUnique;
  const originalReleaseConfig = studentsService.getReleaseConfig;
  const originalResolvePlacement = studentsService.resolveExamPlacement;
  const originalGetStudentById = studentsService.getStudentById;
  const originalPreparePrintStudent = studentsService.preparePrintStudent;
  const originalReserveCandidateNumber = studentsService.reserveCandidateNumber;
  let lookupStudent: any;
  let hallLookup: any = null;
  let reserveCalls = 0;
  let prepareCalls = 0;

  try {
    (prisma.student as any).findFirst = async ({ where }: any) => {
      if (!lookupStudent) return null;
      const normalize = (value: string) => String(value || '').replace(/\D/g, '');
      const identityFilter = where.AND?.[0] || where;
      const identityMatches = (identityFilter.OR || [identityFilter]).some(
        (clause: any) => normalize(clause.cnicOrBForm?.equals) === normalize(lookupStudent.cnicOrBForm),
      );
      if (!identityMatches) return null;
      const identifierFilter = where.AND?.[1];
      if (!identifierFilter) return lookupStudent;
      const identifiers = identifierFilter.OR.map((clause: any) =>
        clause.rollNumber?.equals || clause.applicationNo?.equals || clause.id?.equals,
      );
      return identifiers.some((value: string) =>
        [lookupStudent.rollNumber, lookupStudent.applicationNo, lookupStudent.id].includes(value),
      ) ? lookupStudent : null;
    };
    (prisma.examHall as any).findUnique = async () => hallLookup;
    (studentsService as any).getReleaseConfig = async () => ({
      isScheduled: false,
      releaseDateTime: null,
      // These legacy settings must not supply Hall placement.
      examCenterName: 'Invented center from release config',
      examDate: 'Invented date from release config',
      maleReportingTime: '12:00 PM',
    });

    lookupStudent = {
      id: 'issued-no-hall',
      applicationNo: 'APP-PLACEMENT-1',
      rollNumber: 'AZMVS-9001',
      fullName: 'Issued Candidate',
      fatherName: 'Guardian',
      cnicOrBForm: '11111-2222222-3',
      currentClass: 'Class 10th',
      status: 'ACTIVE',
      feeRecords: [{ status: 'PAID' }],
      assignedHallId: null,
      // Old stored free text should not be promoted to official placement.
      assignedHall: 'Hall from old text',
      assignedRoom: 'Room from old text',
      seatNo: null,
      testCenterName: 'Center from old text',
      testDate: 'Date from old text',
      reportingTime: 'Time from old text',
    };

    const pendingSearch = await studentsService.searchPublicSlip(undefined, lookupStudent.cnicOrBForm);
    assert.equal(pendingSearch.success, false);
    assert.equal(pendingSearch.code, 'PLACEMENT_PENDING');
    assert.match(pendingSearch.error, /assignment is not yet available/i);
    assert.equal((pendingSearch as any).data, undefined, 'pending search never returns a printable slip');

    const wrongIdentity = await studentsService.searchPublicSlip(undefined, '00000-0000000-0');
    assert.equal(wrongIdentity.success, false);
    assert.notEqual(wrongIdentity.code, 'PLACEMENT_PENDING', 'wrong identity cannot reveal placement state');

    const wrongIdentifier = await studentsService.searchPublicSlip('WRONG-APP-ID', lookupStudent.cnicOrBForm);
    assert.equal(wrongIdentifier.success, false);
    assert.notEqual(wrongIdentifier.code, 'PLACEMENT_PENDING', 'wrong optional identifier cannot reveal placement state');
    assert.match(wrongIdentifier.error, /details do not match/i);

    lookupStudent = { ...lookupStudent, status: 'INACTIVE', feeRecords: [{ status: 'UNPAID' }] };
    const unpaidSearch = await studentsService.searchPublicSlip(undefined, lookupStudent.cnicOrBForm);
    assert.equal(unpaidSearch.success, false);
    assert.notEqual(unpaidSearch.code, 'PLACEMENT_PENDING', 'fee verification still precedes placement disclosure');
    assert.match(unpaidSearch.error, /payment.*pending verification/i);

    lookupStudent = {
      ...lookupStudent,
      status: 'ACTIVE',
      feeRecords: [{ status: 'PAID' }],
    };
    (studentsService as any).getReleaseConfig = async () => ({
      isScheduled: true,
      releaseDateTime: '2999-01-01T00:00:00.000Z',
      announcementMessage: 'Official release is scheduled.',
    });
    const unreleasedSearch = await studentsService.searchPublicSlip(undefined, lookupStudent.cnicOrBForm);
    assert.equal(unreleasedSearch.success, false);
    assert.notEqual(unreleasedSearch.code, 'PLACEMENT_PENDING', 'release schedule still precedes placement disclosure');
    assert.match(unreleasedSearch.error, /^SCHEDULED_RELEASE:::/);

    // An explicitly requested provisional preview can reserve a candidate number,
    // while every unverified placement field remains null.
    const provisional = { id: 'provisional-1', rollNumber: null, placementStatus: 'PLACEMENT_PENDING' };
    (studentsService as any).getStudentById = async () => provisional;
    (studentsService as any).reserveCandidateNumber = async () => { reserveCalls++; };
    (studentsService as any).resolveExamPlacement = async () => noHall;
    const preview = await studentsService.preparePrintStudent(provisional.id);
    assert.equal(reserveCalls, 1, 'explicit preview retains its reservation behavior');
    assertPendingPlacement(preview, 'provisional preview');

    // Official issued roll slips must fail before print preparation/reservation.
    const officialPending = {
      id: 'official-pending',
      rollNumber: 'AZMVS-9001',
      ...noHall,
    };
    (studentsService as any).getStudentById = async () => officialPending;
    (studentsService as any).preparePrintStudent = async () => { prepareCalls++; throw new Error('unexpected reservation'); };

    await assert.rejects(
      studentsService.getRollSlipPdf(officialPending.id),
      (error: any) => error.statusCode === 409 && /PLACEMENT_PENDING/.test(error.message),
    );
    await assert.rejects(
      studentsService.getBulkRollSlipsPdf([officialPending.id]),
      (error: any) => error.statusCode === 409 && /PLACEMENT_PENDING/.test(error.message),
    );
    assert.equal(prepareCalls, 0, 'single and bulk official PDFs are blocked before reservation');
  } finally {
    (prisma.student as any).findFirst = originalFindFirst;
    (prisma.examHall as any).findUnique = originalFindHall;
    (studentsService as any).getReleaseConfig = originalReleaseConfig;
    (studentsService as any).resolveExamPlacement = originalResolvePlacement;
    (studentsService as any).getStudentById = originalGetStudentById;
    (studentsService as any).preparePrintStudent = originalPreparePrintStudent;
    (studentsService as any).reserveCandidateNumber = originalReserveCandidateNumber;
  }

  console.log('PASS: roll-slip placement safety checks');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
