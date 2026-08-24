import { prisma } from '../src/lib/prisma';
import { studentsService } from '../src/modules/students/students.service';

async function testDecoupling() {
  console.log('🚀 Running Decoupled Fee Approval & Batch Roll Number Issuance Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, extra?: any) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title}`, extra || '');
      failed++;
    }
  }

  // 1. Register two fresh candidates
  console.log('--- 1. Registering Test Candidates ---');
  const cnic1 = `13504-${Math.floor(1000000 + Math.random() * 9000000)}-1`;
  const cnic2 = `13504-${Math.floor(1000000 + Math.random() * 9000000)}-2`;

  const studentA = await studentsService.createStudent({
    fullName: 'Decouple Candidate Alpha',
    fatherName: 'Guardian Alpha',
    gender: 'MALE',
    dateOfBirth: '2008-01-10',
    cnicOrBForm: cnic1,
    address: 'Mansehra Road',
    district: 'Mansehra',
    province: 'Khyber Pakhtunkhwa',
    parentMobile: '0300-1112233',
    currentClass: 'Class 10th (SSC-II)',
    schoolName: 'Public Model School',
    boardOrUniversity: 'BISE Abbottabad',
    scholarshipCategory: 'GENERAL_MERIT',
    emergencyContact: '0300-1112233',
    emergencyRelation: 'Father',
  });

  const studentB = await studentsService.createStudent({
    fullName: 'Decouple Candidate Beta',
    fatherName: 'Guardian Beta',
    gender: 'FEMALE',
    dateOfBirth: '2008-05-15',
    cnicOrBForm: cnic2,
    address: 'Abbottabad Road',
    district: 'Abbottabad',
    province: 'Khyber Pakhtunkhwa',
    parentMobile: '0300-4445566',
    currentClass: 'Class 10th (SSC-II)',
    schoolName: 'Govt Girls High School',
    boardOrUniversity: 'BISE Abbottabad',
    scholarshipCategory: 'GENERAL_MERIT',
    emergencyContact: '0300-4445566',
    emergencyRelation: 'Mother',
  });

  assert(studentA.rollNumber === null, 'Candidate Alpha initial rollNumber is null');
  assert(studentB.rollNumber === null, 'Candidate Beta initial rollNumber is null');
  assert(studentA.qrImageUrl === null, 'Candidate Alpha initial qrImageUrl is null');

  // 2. Approve Fee Payment for Candidate Alpha and Candidate Beta
  console.log('\n--- 2. Approving Fee Payment (Decoupled Action) ---');
  const approvedA = await studentsService.approvePayment(studentA.id);
  const approvedB = await studentsService.approvePayment(studentB.id);

  assert(approvedA.feeRecords[0]?.status === 'PAID', 'Candidate Alpha fee status is PAID');
  assert(approvedB.feeRecords[0]?.status === 'PAID', 'Candidate Beta fee status is PAID');

  // CRITICAL CHECK: rollNumber MUST remain null immediately after payment approval!
  assert(approvedA.rollNumber === null, 'Candidate Alpha rollNumber remains STRICTLY null after payment approval');
  assert(approvedB.rollNumber === null, 'Candidate Beta rollNumber remains STRICTLY null after payment approval');
  assert(approvedA.qrImageUrl === null, 'Candidate Alpha qrImageUrl remains STRICTLY null after payment approval');
  assert(approvedB.qrImageUrl === null, 'Candidate Beta qrImageUrl remains STRICTLY null after payment approval');

  // Verify DB directly
  const dbA = await prisma.student.findUnique({ where: { id: studentA.id } });
  const dbB = await prisma.student.findUnique({ where: { id: studentB.id } });
  assert(dbA?.rollNumber === null, 'Database confirms Candidate Alpha rollNumber is null in PostgreSQL');
  assert(dbB?.rollNumber === null, 'Database confirms Candidate Beta rollNumber is null in PostgreSQL');

  // 3. Query Roll Number Status
  console.log('\n--- 3. Testing GET /roll-number-status ---');
  const statusBefore = await studentsService.getRollNumberStatus();
  assert(statusBefore.readyCount >= 2, `Roll number status shows ${statusBefore.readyCount} candidate(s) ready for issuance (>= 2)`);
  console.log(`  Ready Count: ${statusBefore.readyCount}, Total Paid Count: ${statusBefore.totalPaidCount}`);

  // 4. Trigger Batch Roll Number Issuance
  console.log('\n--- 4. Triggering POST /issue-roll-numbers (Batch Operation) ---');
  const batchResult = await studentsService.issueRollNumbers({
    scheduledDate: 'Sunday, 25 October 2026',
  });

  assert(batchResult.count >= 2, `Batch issuance successfully assigned roll numbers to ${batchResult.count} candidate(s)`);

  // Verify that Candidate Alpha and Beta now have sequential roll numbers and active QR tokens
  const rolledA = await prisma.student.findUnique({ where: { id: studentA.id } });
  const rolledB = await prisma.student.findUnique({ where: { id: studentB.id } });

  assert(!!rolledA?.rollNumber && rolledA.rollNumber.startsWith('AZMVS-'), `Candidate Alpha has official rollNumber: ${rolledA?.rollNumber}`);
  assert(!!rolledB?.rollNumber && rolledB.rollNumber.startsWith('AZMVS-'), `Candidate Beta has official rollNumber: ${rolledB?.rollNumber}`);
  assert(rolledA?.rollNumber !== rolledB?.rollNumber, 'Candidate Alpha and Beta have distinct sequential roll numbers');
  assert(!!rolledA?.qrToken && rolledA.qrToken.length > 20, 'Candidate Alpha has signed biometric QR token');
  assert(!!rolledB?.qrToken && rolledB.qrToken.length > 20, 'Candidate Beta has signed biometric QR token');

  // 5. Query Roll Number Status After Batch
  console.log('\n--- 5. Verifying Status After Batch Issuance ---');
  const statusAfter = await studentsService.getRollNumberStatus();
  assert(statusAfter.readyCount === 0, `Roll number status shows 0 candidates pending issuance (Actual: ${statusAfter.readyCount})`);
  assert(statusAfter.issuedCount >= 2, `Total issued candidates count is ${statusAfter.issuedCount}`);

  // Cleanup test students
  await prisma.feeRecord.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await prisma.officeUseRecord.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await prisma.documentChecklist.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await prisma.student.deleteMany({ where: { id: { in: [studentA.id, studentB.id] } } });

  console.log(`\n========================================`);
  console.log(`Decoupling Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

testDecoupling().then(() => process.exit(0)).catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
