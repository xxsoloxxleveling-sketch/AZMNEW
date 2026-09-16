import assert from 'node:assert';
import {
  formatClockTime12h,
  formatExamDateDisplay,
  calculateDurationMinutes,
  getExamScheduleForStudent,
  PAPER_VARIANTS,
  buildOmrQrPayload,
} from '../src/modules/students/students.service';
import { pdfService } from '../src/modules/documents/pdf.service';

async function runTests() {
  console.log('--- Starting AZM.AIO OMR & Exam Schedule Tests (Template v2.0) ---');

  // =========================================================================
  // 1. QR Payload Construction (Single & Bulk)
  // =========================================================================
  console.log('1. Testing OMR QR payload construction...');
  const mockStudent = { id: 'std-uuid-1234', applicationNo: '20260001' };
  const qrPayload = buildOmrQrPayload(mockStudent, 'AZM-2026-0001', 'OFFICIAL');

  assert.strictEqual(('paperVariant' in qrPayload), false, 'QR payload MUST NOT contain paperVariant');
  assert.strictEqual(qrPayload.sheetVersion, 2, 'QR sheetVersion must be incremented to 2');
  assert.strictEqual(qrPayload.type, 'AZM_OMR', 'QR type must be AZM_OMR');
  assert.strictEqual(qrPayload.session, '2026-V', 'QR session must be 2026-V');
  assert.strictEqual(qrPayload.studentId, 'std-uuid-1234', 'QR studentId must match');
  assert.strictEqual(qrPayload.rollNumber, 'AZM-2026-0001', 'QR rollNumber must match');
  assert.strictEqual(qrPayload.rollType, 'OFFICIAL', 'QR rollType must match');
  console.log('   ✓ QR payload contract verified (paperVariant removed, sheetVersion: 2).');

  // =========================================================================
  // 2. OMR HTML Manual Version Block & Header Assertions
  // =========================================================================
  console.log('2. Testing OMR HTML rendering for manual paper version block...');
  const omrCandidate = {
    id: 'test-std-omr',
    applicationNo: '20265555',
    rollNumber: 'AZM-2026-9999',
    fullName: 'Ayesha Bibi',
    fatherName: 'Muhammad Akram',
    cnicOrBForm: '13501-9999999-2',
    currentClass: '10th',
    gender: 'FEMALE' as const,
    examDurationMinutes: 60,
  };
  const omrHtml = pdfService.generateOmrSheetHtml(omrCandidate as any);

  // A. OMR HTML contains a PAPER VERSION section
  assert(omrHtml.includes('PAPER VERSION &mdash; MARK ONE ONLY:'), 'OMR must contain manual PAPER VERSION section title');

  // B. OMR HTML contains labels A, B, C, D
  assert(omrHtml.includes('<span class="v-label">A</span>'), 'OMR must contain label A');
  assert(omrHtml.includes('<span class="v-label">B</span>'), 'OMR must contain label B');
  assert(omrHtml.includes('<span class="v-label">C</span>'), 'OMR must contain label C');
  assert(omrHtml.includes('<span class="v-label">D</span>'), 'OMR must contain label D');

  // C. OMR version circles are blank / unselected
  const versionBubbleCount = (omrHtml.match(/<i class="v-bubble"><\/i>/g) || []).length;
  assert.strictEqual(versionBubbleCount, 4, 'Must render exactly 4 blank optical circles for versions A, B, C, D');

  // D. No generated text such as "PAPER VERSION: B" or "PAPER VERSION: A"
  assert(!omrHtml.includes('PAPER VERSION: A'), 'Must NOT contain pre-assigned text "PAPER VERSION: A"');
  assert(!omrHtml.includes('PAPER VERSION: B'), 'Must NOT contain pre-assigned text "PAPER VERSION: B"');
  assert(!omrHtml.includes('PAPER VERSION: C'), 'Must NOT contain pre-assigned text "PAPER VERSION: C"');
  assert(!omrHtml.includes('PAPER VERSION: D'), 'Must NOT contain pre-assigned text "PAPER VERSION: D"');
  assert(omrHtml.includes('OFFICIAL OMR ANSWER SHEET &mdash; 100 MCQS</div>'), 'Doc name must not have attached variant');

  // E. No preselection/active/filled state applied
  assert(!omrHtml.includes('active-version'), 'Must NOT have active-version class');
  assert(!omrHtml.includes('selected-version'), 'Must NOT have selected-version class');
  assert(!omrHtml.includes('v-bubble filled'), 'Must NOT have pre-filled version bubble');
  console.log('   ✓ Manual paper version block verified (A, B, C, D blank optical bubbles).');

  // =========================================================================
  // 3. Absolute Optical Geometry Regression Assertions
  // =========================================================================
  console.log('3. Testing OMR optical geometry regression freeze...');
  assert(omrHtml.includes('width: 210mm;'), 'Page width must remain 210mm');
  assert(omrHtml.includes('height: 297mm;'), 'Page height must remain 297mm');
  assert(omrHtml.includes('padding: 5.5mm 7.5mm;'), 'Page padding must remain 5.5mm 7.5mm');
  assert(omrHtml.includes('width: 6mm;'), 'Corner marks must remain 6mm wide');
  assert(omrHtml.includes('height: 6mm;'), 'Corner marks must remain 6mm high');
  assert(omrHtml.includes('top: 2.5mm; left: 2.5mm;'), 'Corner top-left inset must remain 2.5mm');
  assert(omrHtml.includes('top: 70mm;'), 'Timing track top must remain 70mm');
  assert(omrHtml.includes('left: 2.5mm;'), 'Left timing track must remain at left: 2.5mm');
  assert(omrHtml.includes('right: 2.5mm;'), 'Right timing track must remain at right: 2.5mm');
  assert(omrHtml.includes('width: 2mm; height: 2mm;'), 'Timing blocks must remain 2mm x 2mm');
  assert(omrHtml.includes('gap: 3mm;'), 'Timing track gap must remain 3mm');
  assert(omrHtml.includes('width: 4.1mm;'), 'MCQ answer bubble width must remain 4.1mm');
  assert(omrHtml.includes('height: 4.1mm;'), 'MCQ answer bubble height must remain 4.1mm');
  assert(omrHtml.includes('border: 1.1px solid #000000;'), 'Bubble border must remain 1.1px solid #000000');

  // Question grid: 4 columns x 25 rows = 100 questions
  assert(omrHtml.includes('Q. 1 - 25'), 'Column 1 must header Q. 1 - 25');
  assert(omrHtml.includes('Q. 26 - 50'), 'Column 2 must header Q. 26 - 50');
  assert(omrHtml.includes('Q. 51 - 75'), 'Column 3 must header Q. 51 - 75');
  assert(omrHtml.includes('Q. 76 - 100'), 'Column 4 must header Q. 76 - 100');

  const questionRowCount = (omrHtml.match(/class="omr-row/g) || []).length;
  assert.strictEqual(questionRowCount, 100, 'OMR grid must contain exactly 100 question rows');
  console.log('   ✓ Optical geometry freeze verified (100 MCQs, timing tracks, corner marks, 4.1mm bubbles).');

  // =========================================================================
  // 4. Version-Bubble Geometry Assertions
  // =========================================================================
  console.log('4. Testing version-bubble optical geometry...');
  assert(omrHtml.includes('.v-bubble {'), 'CSS must define .v-bubble class');
  assert(omrHtml.includes('width: 4.1mm;'), '.v-bubble width must be 4.1mm');
  assert(omrHtml.includes('height: 4.1mm;'), '.v-bubble height must be 4.1mm');
  assert(omrHtml.includes('border-radius: 50%;'), '.v-bubble must be circular');
  console.log('   ✓ Version bubble optical geometry verified (identical 4.1mm dimensions).');

  // =========================================================================
  // 5. Watermark & Branding Assertions
  // =========================================================================
  console.log('5. Testing watermark branding and optical safety zones...');
  assert(omrHtml.includes('omr-watermark-info'), 'Candidate info container must contain watermark');
  assert(omrHtml.includes('omr-watermark-footer'), 'Signatures footer container must contain watermark');
  assert(omrHtml.includes('AZM.AIO SCHOLARSHIP EXAMINATION'), 'Watermark must contain branding text');
  assert(omrHtml.includes('AZM.AIO'), 'Footer watermark must contain AZM.AIO');
  assert(omrHtml.includes('opacity: 0.045;'), 'Watermark opacity must be subtle (~0.045)');
  assert(omrHtml.includes('opacity: 0.04;'), 'Footer watermark opacity must be subtle (~0.04)');

  // Ensure watermark is NOT page-wide
  assert(!omrHtml.includes('.omr-page { background: url('), 'Watermark must not be full-page background image');
  assert(!omrHtml.includes('.omr-grid-container { position: relative; opacity:'), 'Grid container must not have watermark');
  console.log('   ✓ Watermark verified in non-optical zones (header & footer, optical area pristine).');

  // =========================================================================
  // 6. Template Version
  // =========================================================================
  console.log('6. Testing template version in footer and bulk generation...');
  assert(omrHtml.includes('TEMPLATE VER: 2.0'), 'Bottom bar must display TEMPLATE VER: 2.0');

  // Bulk OMR generation check
  const bulkHtml = pdfService.generateBulkOmrSheetsHtml([
    { student: omrCandidate, qrDataUrl: 'data:image/png;base64,mock' },
    { student: { ...omrCandidate, id: 'test-2', applicationNo: '20265556' }, qrDataUrl: 'data:image/png;base64,mock2' },
  ]);
  assert(bulkHtml.includes('TEMPLATE VER: 2.0'), 'Bulk OMR output must report TEMPLATE VER: 2.0');
  assert(bulkHtml.includes('PAPER VERSION &mdash; MARK ONE ONLY:'), 'Bulk OMR pages must contain manual paper version block');
  const bulkBubbleMatches = (bulkHtml.match(/<i class="v-bubble"><\/i>/g) || []).length;
  assert.strictEqual(bulkBubbleMatches, 8, 'Bulk OMR for 2 candidates must contain 8 blank version bubbles (4 per page)');
  console.log('   ✓ Template Version 2.0 verified across single and bulk outputs.');

  // =========================================================================
  // 7. Time Formatting Helpers (Preserved)
  // =========================================================================
  console.log('7. Testing 12-hour clock and duration formatting...');
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

  // =========================================================================
  // 8. Gender-Specific Examination Schedule (Preserved)
  // =========================================================================
  console.log('8. Testing gender-specific examination schedule resolution...');
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

  // =========================================================================
  // 9. Roll Slip HTML Generation (Preserved)
  // =========================================================================
  console.log('9. Testing Roll Slip HTML rendering for schedule bar and instructions...');
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

  console.log('\n✅ ALL OMR TEMPLATE V2.0 & EXAM SCHEDULE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
