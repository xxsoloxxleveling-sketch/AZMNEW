import assert from 'node:assert';
import {
  getPaperVariant,
  formatClockTime12h,
  formatExamDateDisplay,
  calculateDurationMinutes,
  getExamScheduleForStudent,
  PAPER_VARIANTS,
} from '../src/modules/students/students.service';
import { pdfService } from '../src/modules/documents/pdf.service';

async function runTests() {
  console.log('--- Starting Exam Schedule & Paper Variant Tests ---');

  // 1. Determinism Test
  console.log('1. Testing getPaperVariant determinism...');
  const studentA = { id: 'std-uuid-1234', applicationNo: '20260001', currentClass: 'SSC-II (Class 10th)' };
  const variantFirst = getPaperVariant(studentA);
  assert(PAPER_VARIANTS.includes(variantFirst), `Variant ${variantFirst} must be one of A, B, C, D`);

  for (let i = 0; i < 50; i++) {
    const variantRepeated = getPaperVariant(studentA);
    assert.strictEqual(variantRepeated, variantFirst, 'Paper variant must be strictly deterministic across calls');
  }

  // Class normalization check
  const studentANormalized = { id: 'std-uuid-1234', applicationNo: '20260001', currentClass: ' ssc-ii (class 10th) ' };
  assert.strictEqual(getPaperVariant(studentANormalized), variantFirst, 'Paper variant must normalize class casing and whitespace');
  console.log(`   ✓ Determinism verified (Student generated variant: ${variantFirst}).`);

  // 2. Paper Variant Distribution
  console.log('2. Testing paper variant distribution across multiple candidates...');
  const seenVariants = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const variant = getPaperVariant({
      id: `student-id-${i}`,
      applicationNo: `2026${1000 + i}`,
      currentClass: i % 2 === 0 ? '10th' : '9th',
    });
    seenVariants.add(variant);
  }
  assert.strictEqual(seenVariants.size, 4, 'Distribution across 100 students should hit all 4 variants (A, B, C, D)');
  console.log(`   ✓ Distribution verified (Found all variants: ${Array.from(seenVariants).sort().join(', ')}).`);

  // 3. Time Formatting Helpers
  console.log('3. Testing 12-hour clock and duration formatting...');
  assert.strictEqual(formatClockTime12h('08:00'), '08:00 AM');
  assert.strictEqual(formatClockTime12h('09:00'), '09:00 AM');
  assert.strictEqual(formatClockTime12h('10:00'), '10:00 AM');
  assert.strictEqual(formatClockTime12h('11:00'), '11:00 AM');
  assert.strictEqual(formatClockTime12h('12:00'), '12:00 PM');
  assert.strictEqual(formatClockTime12h('13:00'), '01:00 PM');
  assert.strictEqual(formatClockTime12h('14:30'), '02:30 PM');

  assert.strictEqual(calculateDurationMinutes('09:00', '10:00'), 60);
  assert.strictEqual(calculateDurationMinutes('12:00', '13:00'), 60);
  assert.strictEqual(calculateDurationMinutes('09:00', '11:00'), 120);

  assert.strictEqual(formatExamDateDisplay('2026-11-15'), 'Sunday, 15 November 2026');
  console.log('   ✓ Clock, duration, and date formatting verified.');

  // 4. Gender-Specific Examination Schedule
  console.log('4. Testing gender-specific examination schedule resolution...');
  const defaultConfig = {
    examCenterName: 'Dubai International School and College Boys Campus Mansehra',
    examDate: '2026-11-15',
    femaleReportingTime: '08:00',
    femaleTestStartTime: '09:00',
    femaleTestEndTime: '10:00',
    maleReportingTime: '11:00',
    maleTestStartTime: '12:00',
    maleTestEndTime: '13:00',
  };

  const femaleCandidate = { id: 'female-1', gender: 'FEMALE' as const, currentClass: '10th' };
  const femaleSchedule = getExamScheduleForStudent(femaleCandidate, defaultConfig);
  assert.strictEqual(femaleSchedule.reportingTime, '08:00 AM');
  assert.strictEqual(femaleSchedule.testStartTime, '09:00 AM');
  assert.strictEqual(femaleSchedule.testEndTime, '10:00 AM');
  assert.strictEqual(femaleSchedule.testTimeLabel, '09:00 AM - 10:00 AM');
  assert.strictEqual(femaleSchedule.durationMinutes, 60);
  assert.strictEqual(femaleSchedule.testCenterName, 'Dubai International School and College Boys Campus Mansehra');
  assert.strictEqual(femaleSchedule.testDate, 'Sunday, 15 November 2026');
  console.log('   ✓ Female candidate schedule verified (Reporting: 08:00 AM, Exam: 09:00 AM - 10:00 AM).');

  const maleCandidate = { id: 'male-1', gender: 'MALE' as const, currentClass: '10th' };
  const maleSchedule = getExamScheduleForStudent(maleCandidate, defaultConfig);
  assert.strictEqual(maleSchedule.reportingTime, '11:00 AM');
  assert.strictEqual(maleSchedule.testStartTime, '12:00 PM');
  assert.strictEqual(maleSchedule.testEndTime, '01:00 PM');
  assert.strictEqual(maleSchedule.testTimeLabel, '12:00 PM - 01:00 PM');
  assert.strictEqual(maleSchedule.durationMinutes, 60);
  assert.strictEqual(maleSchedule.testCenterName, 'Dubai International School and College Boys Campus Mansehra');
  assert.strictEqual(maleSchedule.testDate, 'Sunday, 15 November 2026');
  console.log('   ✓ Male candidate schedule verified (Reporting: 11:00 AM, Exam: 12:00 PM - 01:00 PM).');

  // Missing gender throws
  assert.throws(
    () => getExamScheduleForStudent({ id: 'missing-1', currentClass: '10th' }, defaultConfig),
    /Candidate gender is missing or invalid; examination schedule cannot be resolved\./,
    'Missing gender must throw controlled error'
  );
  console.log('   ✓ Missing gender rejection verified.');

  // Unknown gender throws
  assert.throws(
    () => getExamScheduleForStudent({ id: 'unknown-1', gender: 'UNKNOWN' as any, currentClass: '10th' }, defaultConfig),
    /Candidate gender is missing or invalid; examination schedule cannot be resolved\./,
    'Unknown gender must throw controlled error'
  );
  console.log('   ✓ Unknown gender rejection verified.');

  // 5. OMR HTML Generation
  console.log('5. Testing OMR HTML rendering for paper variant and duration...');
  const omrCandidate = {
    id: 'test-std-omr',
    applicationNo: '20265555',
    rollNumber: 'AZM-2026-9999',
    fullName: 'Ayesha Bibi',
    fatherName: 'Muhammad Akram',
    cnicOrBForm: '13501-9999999-2',
    currentClass: '10th',
    gender: 'FEMALE' as const,
    paperVariant: 'B' as const,
    examDurationMinutes: 60,
  };
  const omrHtml = pdfService.generateOmrSheetHtml(omrCandidate as any);
  assert(omrHtml.includes('PAPER VERSION: B'), 'OMR header badge must display assigned PAPER VERSION: B');
  assert(omrHtml.includes('Timing:</strong> 60 Mins | <strong>Total MCQs:</strong> 100'), 'OMR timing must be 60 Mins');
  console.log('   ✓ OMR HTML rendering verified.');

  // 6. Roll Slip HTML Generation
  console.log('6. Testing Roll Slip HTML rendering for schedule bar and instructions...');
  const slipCandidate = {
    id: 'test-std-slip',
    applicationNo: '20268888',
    rollNumber: 'AZM-2026-8888',
    fullName: 'Zubair Ahmed',
    fatherName: 'Ahmed Ali',
    cnicOrBForm: '13501-8888888-1',
    currentClass: 'SSC-I (Class 9th)',
    gender: 'MALE' as const,
    testCenterName: 'Dubai International School and College Boys Campus Mansehra',
    testDate: 'Sunday, 15 November 2026',
    reportingTime: '11:00 AM',
    examStartTime: '12:00 PM - 01:00 PM',
  };
  const slipHtml = pdfService.generateRollSlipHtml(slipCandidate as any);
  assert(slipHtml.includes('Test Time</div>'), 'Schedule bar must display label "Test Time"');
  assert(slipHtml.includes('11:00 AM'), 'Schedule bar must display reporting time 11:00 AM');
  assert(slipHtml.includes('12:00 PM - 01:00 PM'), 'Schedule bar must display exam timing');
  assert(
    slipHtml.includes('Candidate must report at the Reporting Time printed above. Late entry may not be permitted.'),
    'Instructions must contain updated reporting rule'
  );
  console.log('   ✓ Roll Slip HTML rendering verified.');

  console.log('\n✅ ALL EXAM SCHEDULE & PAPER VARIANT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
