import { prisma } from '../src/lib/prisma';
import { studentsService } from '../src/modules/students/students.service';
import { dashboardService } from '../src/modules/dashboard/dashboard.service';
import { feesService } from '../src/modules/fees/fees.service';

async function verifyIntegrity() {
  console.log('🚀 Starting Data Integrity & Verification Audit Suite...\n');

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

  // 1. Check existing student APP-2026-0001 in Database
  console.log('--- 1. Testing Existing Student State ---');
  const existing = await prisma.student.findFirst({
    where: { applicationNo: 'APP-2026-0001' },
    include: { feeRecords: true, officeUse: true },
  });

  assert(!!existing, 'Student APP-2026-0001 exists in PostgreSQL database');
  if (existing) {
    const feeRec = existing.feeRecords[0];
    assert(feeRec?.status === 'UNPAID', `Student fee status in database is UNPAID (Actual: ${feeRec?.status})`);
    assert(existing.officeUse?.documentVerifiedBy === null, 'Document verification by admin is null (not auto-approved)');
    assert(existing.officeUse?.eligibility === null, 'Eligibility is null/pending (not auto-approved)');
    assert(existing.officeUse?.finalStatus === null, 'Final status is null/pending (not auto-approved)');
  }

  // 2. Test Registration of a Fresh Candidate through real service
  console.log('\n--- 2. Testing Fresh Candidate Registration Flow ---');
  const uniqueCnic = `13503-${Math.floor(1000000 + Math.random() * 9000000)}-${Math.floor(1 + Math.random() * 9)}`;
  const freshCandidate = await studentsService.createStudent({
    fullName: 'Audit Integrity Student',
    fatherName: 'Guardian Name',
    gender: 'FEMALE',
    dateOfBirth: '2008-04-12',
    cnicOrBForm: uniqueCnic,
    address: 'Abbottabad Road, Mansehra',
    district: 'Mansehra',
    province: 'Khyber Pakhtunkhwa',
    parentMobile: '0312-9988776',
    currentClass: 'Class 10th (SSC-II)',
    schoolName: 'Public High School',
    boardOrUniversity: 'BISE Abbottabad',
    scholarshipCategory: 'GENERAL_MERIT',
    emergencyContact: '0312-9988776',
    emergencyRelation: 'Guardian',
  });

  assert(!!freshCandidate.id, 'Fresh candidate registered successfully');
  assert(freshCandidate.rollNumber === null, 'Roll Number is deferred upon initial registration (null)');
  assert(freshCandidate.qrToken.startsWith('PENDING-FEE-'), 'QR Token is designated as PENDING-FEE');

  // Verify DB state of fresh candidate
  const freshInDb = await prisma.student.findUnique({
    where: { id: freshCandidate.id },
    include: { feeRecords: true, officeUse: true },
  });

  assert(freshInDb?.feeRecords[0]?.status === 'UNPAID', 'Fresh student feeRecord status is strictly UNPAID');
  assert(Number(freshInDb?.feeRecords[0]?.amountPaid) === 0, 'Fresh student amountPaid is strictly 0');
  assert(freshInDb?.officeUse?.documentVerifiedBy === null, 'Fresh student documentVerifiedBy is strictly null');
  assert(freshInDb?.officeUse?.eligibility === null, 'Fresh student eligibility is strictly null');
  assert(freshInDb?.officeUse?.finalStatus === null, 'Fresh student finalStatus is strictly null');

  // 3. Test Dashboard Overview Aggregation with Live Data
  console.log('\n--- 3. Testing Dashboard Overview Aggregations ---');
  const overview = await dashboardService.getOverview();

  const totalInDb = await prisma.student.count();
  assert(overview.stats.totalStudents === totalInDb, `Dashboard Total Registered Students (${overview.stats.totalStudents}) matches DB count (${totalInDb})`);
  assert(overview.stats.totalActiveStudents === totalInDb, `Dashboard Total Active Students matches DB count (${totalInDb})`);
  assert(overview.feeCollection.totalBilled === totalInDb * 300, `Dashboard Total Billed fee (PKR ${overview.feeCollection.totalBilled}) matches total candidates * 300`);

  // 4. Test Explicit Payment Approval Flow (Real Accountant Action)
  console.log('\n--- 4. Testing Explicit Fee Payment Approval Flow ---');
  const feeId = freshInDb!.feeRecords[0]!.id;
  const payResult = await feesService.markFeePaid(feeId, {
    amountPaid: 300,
    paymentMethod: 'CASH',
    remarks: 'Official cash payment received at desk',
  });

  assert(payResult.feeRecord.status === 'PAID', 'FeeRecord status updated to PAID upon explicit accountant action');
  assert(Number(payResult.feeRecord.amountPaid) === 300, 'FeeRecord amountPaid updated to 300');

  // Verify dashboard updates accurately
  const updatedOverview = await dashboardService.getOverview();
  assert(
    updatedOverview.feeCollection.totalCollected === 300,
    `Dashboard Total Collected reflects PKR 300 after explicit payment (Actual: PKR ${updatedOverview.feeCollection.totalCollected})`
  );
  console.log(`  Updated Collection Rate: ${updatedOverview.feeCollection.collectionPercentage}%`);

  // Cleanup test candidate
  await prisma.feeRecord.deleteMany({ where: { studentId: freshCandidate.id } });
  await prisma.officeUseRecord.deleteMany({ where: { studentId: freshCandidate.id } });
  await prisma.documentChecklist.deleteMany({ where: { studentId: freshCandidate.id } });
  await prisma.student.delete({ where: { id: freshCandidate.id } });

  console.log(`\n========================================`);
  console.log(`Integrity Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

verifyIntegrity().then(() => process.exit(0)).catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
