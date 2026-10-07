import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { studentsService } from '../src/modules/students/students.service';
import { studentsController } from '../src/modules/students/students.controller';

async function runSlipSearchTests() {
  console.log('🚀 Running Public Roll Number Slip CNIC-Only Search Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assertTest(condition: boolean, title: string, extra?: any) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title}`, extra || '');
      failed++;
    }
  }

  const testIdsToClean: string[] = [];
  let fixtureHallId: string | undefined;
  let fixtureCenterId: string | undefined;

  try {
    const testSuffix = Math.floor(1000000 + Math.random() * 9000000); // 7 digits
    const cnicUnformatted = `99999${testSuffix}1`; // 5 + 7 + 1 = 13 digits
    const cnicFormatted = `99999-${testSuffix}-1`;
    const appNoA = `TEST-APP-${testSuffix}-A`;
    const rollNoA = `TEST-ROLL-${testSuffix}-A`;

    const cnicScheduled = `99999${testSuffix}2`;
    const appNoScheduled = `TEST-APP-${testSuffix}-B`;

    const cnicUnpaid = `99999${testSuffix}3`;
    const appNoUnpaid = `TEST-APP-${testSuffix}-C`;

    const center = await prisma.testCenter.create({ data: { name: 'Confirmed Test Venue', code: 'SLIP-' + testSuffix, address: 'Test venue address', district: 'Test district' } });
    fixtureCenterId = center.id;
    const hall = await prisma.examHall.create({ data: { name: 'Confirmed Test Hall', roomNumber: 'Room N', targetClass: 'Test', capacity: 20, testCenterId: center.id, examDate: 'Confirmed exam date', reportingTime: '08:15 AM' } });
    fixtureHallId = hall.id;
    // Candidate A: Active, Fee Paid, Roll Number Issued, Unscheduled / Released
    const studentA = await prisma.student.create({
      data: {
        assignedHallId: hall.id, seatNo: 'N-7',
        applicationNo: appNoA,
        fullName: 'Test Candidate Slip Alpha',
        fatherName: 'Father Alpha',
        gender: 'MALE',
        dateOfBirth: new Date('2008-01-01'),
        cnicOrBForm: cnicFormatted, // registered with hyphens
        address: 'Test Address',
        district: 'Abbottabad',
        province: 'Khyber Pakhtunkhwa',
        parentMobile: '0300-1234567',
        currentClass: 'Class 10th (SSC-II)',
        schoolName: 'Test School',
        boardOrUniversity: 'BISE Abbottabad',
        scholarshipCategory: 'GENERAL_MERIT',
        emergencyContact: '0300-1234567',
        emergencyRelation: 'Father',
        qrToken: `QR-${testSuffix}-A`,
        rollNumber: rollNoA,
        status: 'ACTIVE',
        feeRecords: {
          create: {
            month: 'October 2026',
            amountDue: 300,
            amountPaid: 300,
            status: 'PAID',
            challanNumber: `CH-${testSuffix}-A`,
            dueDate: new Date(),
            paidAt: new Date(),
          },
        },
      },
    });
    testIdsToClean.push(studentA.id);

    // Candidate B: Active, Fee Paid, but No Roll Number (triggers scheduled release)
    const studentB = await prisma.student.create({
      data: {
        applicationNo: appNoScheduled,
        fullName: 'Test Candidate Scheduled Beta',
        fatherName: 'Father Beta',
        gender: 'FEMALE',
        dateOfBirth: new Date('2008-02-02'),
        cnicOrBForm: cnicScheduled,
        address: 'Test Address',
        district: 'Abbottabad',
        province: 'Khyber Pakhtunkhwa',
        parentMobile: '0300-2345678',
        currentClass: 'Class 10th (SSC-II)',
        schoolName: 'Test School',
        boardOrUniversity: 'BISE Abbottabad',
        scholarshipCategory: 'GENERAL_MERIT',
        emergencyContact: '0300-2345678',
        emergencyRelation: 'Father',
        qrToken: `QR-${testSuffix}-B`,
        rollNumber: null, // No roll number -> scheduled release notice
        status: 'ACTIVE',
        feeRecords: {
          create: {
            month: 'October 2026',
            amountDue: 300,
            amountPaid: 300,
            status: 'PAID',
            challanNumber: `CH-${testSuffix}-B`,
            dueDate: new Date(),
            paidAt: new Date(),
          },
        },
      },
    });
    testIdsToClean.push(studentB.id);

    // Candidate C: Active, Unpaid Fee
    const studentC = await prisma.student.create({
      data: {
        applicationNo: appNoUnpaid,
        fullName: 'Test Candidate Unpaid Gamma',
        fatherName: 'Father Gamma',
        gender: 'MALE',
        dateOfBirth: new Date('2008-03-03'),
        cnicOrBForm: cnicUnpaid,
        address: 'Test Address',
        district: 'Abbottabad',
        province: 'Khyber Pakhtunkhwa',
        parentMobile: '0300-3456789',
        currentClass: 'Class 10th (SSC-II)',
        schoolName: 'Test School',
        boardOrUniversity: 'BISE Abbottabad',
        scholarshipCategory: 'GENERAL_MERIT',
        emergencyContact: '0300-3456789',
        emergencyRelation: 'Father',
        qrToken: `QR-${testSuffix}-C`,
        rollNumber: null,
        status: 'ACTIVE',
        feeRecords: {
          create: {
            month: 'October 2026',
            amountDue: 300,
            amountPaid: 0,
            status: 'UNPAID',
            challanNumber: `CH-${testSuffix}-C`,
            dueDate: new Date(),
          },
        },
      },
    });
    testIdsToClean.push(studentC.id);

    console.log('--- 1. Testing Exact CNIC Only ---');
    const res1 = await studentsService.searchPublicSlip(undefined, cnicFormatted);
    assertTest(res1.success === true && res1.data?.rollNo === rollNoA, 'Exact registered CNIC only finds correct candidate', res1);

    console.log('--- 2. Testing Formatted vs Unformatted CNIC Normalization ---');
    // Candidate registered with formatted CNIC, search with unformatted digits
    const res2 = await studentsService.searchPublicSlip('', cnicUnformatted);
    assertTest(res2.success === true && res2.data?.rollNo === rollNoA, 'Unformatted CNIC digits resolves candidate registered with hyphens', res2);

    console.log('--- 3. Testing CNIC + Correct Application ID ---');
    const res3 = await studentsService.searchPublicSlip(appNoA, cnicFormatted);
    assertTest(res3.success === true && res3.data?.applicationId === appNoA, 'CNIC + matching Application ID succeeds', res3);

    console.log('--- 4. Testing CNIC + Correct Roll Number ---');
    const res4 = await studentsService.searchPublicSlip(rollNoA, cnicFormatted);
    assertTest(res4.success === true && res4.data?.rollNo === rollNoA, 'CNIC + matching Roll Number succeeds', res4);

    console.log('--- 5. Testing Correct CNIC + Wrong Application ID ---');
    const res5 = await studentsService.searchPublicSlip('WRONG-APP-ID', cnicFormatted);
    assertTest(
      res5.success === false && res5.error === 'The provided details do not match an issued Roll Number Slip.',
      'Correct CNIC + wrong Application ID fails without leaking match',
      res5
    );

    console.log('--- 6. Testing Correct CNIC + Wrong Roll Number ---');
    const res6 = await studentsService.searchPublicSlip('WRONG-ROLL-999', cnicFormatted);
    assertTest(
      res6.success === false && res6.error === 'The provided details do not match an issued Roll Number Slip.',
      'Correct CNIC + wrong Roll Number fails strictly (not silently ignored)',
      res6
    );

    console.log('--- 7. Testing Wrong CNIC + Correct Roll Number ---');
    const res7 = await studentsService.searchPublicSlip(rollNoA, '00000-0000000-0');
    assertTest(res7.success === false, 'Wrong CNIC with valid roll number fails', res7);

    console.log('--- 8. Testing Empty CNIC Handling ---');
    const res8Service = await studentsService.searchPublicSlip(rollNoA, '');
    assertTest(res8Service.success === false, 'Service rejects empty CNIC', res8Service);

    // Controller level check for empty CNIC -> 400
    let ctrlStatus = 0;
    let ctrlBody: any = null;
    const mockReq = {
      body: { query: rollNoA, cnic: '' },
      headers: {},
    } as any;
    const mockRes = {
      status(code: number) {
        ctrlStatus = code;
        return this;
      },
      json(body: any) {
        ctrlBody = body;
        return this;
      },
    } as any;
    await studentsController.searchPublicSlip(mockReq, mockRes, () => {});
    assertTest(ctrlStatus === 400 && ctrlBody?.success === false, 'Controller returns HTTP 400 for empty CNIC', { ctrlStatus, ctrlBody });

    // Controller accepts CNIC in body with no query
    let ctrlStatusOnlyCnic = 0;
    let ctrlBodyOnlyCnic: any = null;
    const mockReqOnlyCnic = {
      body: { cnic: cnicFormatted },
      headers: {},
    } as any;
    const mockResOnlyCnic = {
      status(code: number) {
        ctrlStatusOnlyCnic = code;
        return this;
      },
      json(body: any) {
        ctrlBodyOnlyCnic = body;
        return this;
      },
    } as any;
    await studentsController.searchPublicSlip(mockReqOnlyCnic, mockResOnlyCnic, () => {});
    assertTest(
      ctrlStatusOnlyCnic === 200 && ctrlBodyOnlyCnic?.success === true && ctrlBodyOnlyCnic?.data?.rollNo === rollNoA,
      'Controller succeeds with CNIC-only in body (HTTP 200)',
      ctrlBodyOnlyCnic
    );

    // Controller accepts CNIC in X-Candidate-CNIC header
    let ctrlStatusHeader = 0;
    let ctrlBodyHeader: any = null;
    const mockReqHeader = {
      body: {},
      headers: { 'x-candidate-cnic': cnicFormatted },
    } as any;
    const mockResHeader = {
      status(code: number) {
        ctrlStatusHeader = code;
        return this;
      },
      json(body: any) {
        ctrlBodyHeader = body;
        return this;
      },
    } as any;
    await studentsController.searchPublicSlip(mockReqHeader, mockResHeader, () => {});
    assertTest(
      ctrlStatusHeader === 200 && ctrlBodyHeader?.success === true && ctrlBodyHeader?.data?.rollNo === rollNoA,
      'Controller succeeds with CNIC in X-Candidate-CNIC header',
      ctrlBodyHeader
    );

    console.log('--- 9. Testing Partial CNIC ---');
    const res9 = await studentsService.searchPublicSlip(undefined, '99999');
    assertTest(res9.success === false, 'Partial CNIC (5 digits) fails to match', res9);

    const res9Short = await studentsService.searchPublicSlip(undefined, '1234');
    assertTest(res9Short.success === false, 'Short CNIC (< 5 digits) fails validation', res9Short);

    console.log('--- 10. Testing Candidate Name Rejection ---');
    const res10 = await studentsService.searchPublicSlip(undefined, 'Test Candidate Slip Alpha');
    assertTest(res10.success === false, 'Candidate name passed as CNIC fails', res10);

    const res10Query = await studentsService.searchPublicSlip('Test Candidate Slip Alpha', cnicFormatted);
    assertTest(res10Query.success === false, 'Candidate name passed as query fails', res10Query);

    console.log('--- 11. Testing Scheduled Release Notice Preservation ---');
    const res11 = await studentsService.searchPublicSlip(undefined, cnicScheduled);
    assertTest(
      res11.success === false && typeof res11.error === 'string' && res11.error.startsWith('SCHEDULED_RELEASE:::'),
      'Candidate without issued roll number triggers SCHEDULED_RELEASE response',
      res11
    );

    console.log('--- 12. Testing Unpaid Candidate Notice Preservation ---');
    const res12 = await studentsService.searchPublicSlip(undefined, cnicUnpaid);
    assertTest(
      res12.success === false && typeof res12.error === 'string' && res12.error.includes('Registration fee payment of PKR 300 is pending verification'),
      'Unpaid candidate triggers registration fee verification message',
      res12
    );

  } finally {
    // Cleanup: Remove all test records created during this run
    console.log('\n--- Cleanup: Removing test candidates ---');
    for (const id of testIdsToClean) {
      await prisma.feeRecord.deleteMany({ where: { studentId: id } });
      await prisma.student.delete({ where: { id } }).catch(() => {});
    }
    console.log(`Cleaned up ${testIdsToClean.length} test record(s).`);
    if (fixtureHallId) await prisma.examHall.delete({ where: { id: fixtureHallId } });
    if (fixtureCenterId) await prisma.testCenter.delete({ where: { id: fixtureCenterId } });
  }

  console.log(`\n========================================`);
  console.log(`Slip Search Tests: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSlipSearchTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
