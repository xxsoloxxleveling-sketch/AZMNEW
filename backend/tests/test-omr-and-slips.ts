import assert from 'node:assert';
import { pdfService } from '../src/modules/documents/pdf.service';

async function runTests() {
  console.log('--- Starting OMR and Roll Slip Tests ---');

  const mockOfficialCandidate = {
    id: 'test-student-official-1',
    applicationNo: '20260012',
    rollNumber: 'AZMVS-2026-0001',
    fullName: 'Muhammad Ahmad Khan',
    fatherName: 'Tariq Khan',
    cnicOrBForm: '13501-1234567-1',
    currentClass: '10th',
    gender: 'MALE' as const,
    parentMobile: '03001234567',
    testCenterName: 'AZM Central Examination Center, Mansehra',
    testCenterAddress: 'College Road, Mansehra',
    testDate: 'Sunday, 20 November 2026',
    reportingTime: '08:30 AM',
    examStartTime: '09:30 AM',
    assignedHall: 'Hall A (Main Examination Wing)',
    assignedRoom: 'Room 101',
    seatNo: 'Seat # 12',
    photoBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };

  const mockProvisionalCandidate = {
    id: 'test-student-prov-2',
    applicationNo: '20260099',
    rollNumber: '',
    fullName: 'Fatima Noor',
    fatherName: 'Noor Muhammad',
    cnicOrBForm: '13501-7654321-2',
    currentClass: '1st Year',
    gender: 'FEMALE' as const,
    parentMobile: '03129876543',
    testCenterName: 'AZM Regional Center, Abbottabad',
    testCenterAddress: 'Karakoram Highway, Abbottabad',
    testDate: 'Sunday, 20 November 2026',
    reportingTime: '08:30 AM',
    examStartTime: '09:30 AM',
    assignedHall: 'Hall B',
    assignedRoom: 'Room 204',
    seatNo: 'Seat # 45',
  };

  // 1. Test Official Roll Slip Generation
  console.log('1. Testing official roll slip HTML generation...');
  const officialSlipHtml = pdfService.generateRollSlipHtml(mockOfficialCandidate as any);
  assert(officialSlipHtml.includes('AZMVS-2026-0001'), 'Official slip must include official roll number');
  assert(!officialSlipHtml.includes('PRE-ISSUE COPY'), 'Official slip must NOT include pre-issue warning');
  assert(officialSlipHtml.toUpperCase().includes('MUHAMMAD AHMAD KHAN'), 'Must include candidate name');
  console.log('   ✓ Official roll slip HTML verified.');

  // 2. Test Provisional Roll Slip Generation
  console.log('2. Testing provisional roll slip HTML generation...');
  const provSlipHtml = pdfService.generateRollSlipHtml(mockProvisionalCandidate as any);
  assert(provSlipHtml.includes('PRE-ISSUE COPY — OFFICIAL ROLL NUMBER NOT YET ISSUED'), 'Provisional slip must have amber warning banner');
  assert(provSlipHtml.includes('PROV-20260099'), 'Provisional slip must have PROV- identifier');
  assert(provSlipHtml.toUpperCase().includes('FATIMA NOOR'), 'Must include candidate name');
  console.log('   ✓ Provisional roll slip HTML verified.');

  // 3. Test Official OMR Sheet Generation
  console.log('3. Testing official OMR sheet HTML generation (100 MCQs)...');
  const officialOmrHtml = await pdfService.generateOmrSheetHtml(mockOfficialCandidate as any);
  assert(officialOmrHtml.includes('100 MCQS'), 'OMR sheet must specify 100 MCQS');
  assert(officialOmrHtml.includes('AZMVS-2026-0001'), 'Must include candidate official roll number');
  assert(officialOmrHtml.includes('corner-tl') && officialOmrHtml.includes('corner-br'), 'Must include alignment corner marks');
  assert(officialOmrHtml.includes('Candidate Signature'), 'Must include candidate signature block');
  assert(officialOmrHtml.includes('Invigilator Signature'), 'Must include invigilator signature block');
  // Check bubbles presence: 100 questions x 4 options
  assert(officialOmrHtml.includes('class="bubble">A</span>') && officialOmrHtml.includes('class="bubble">D</span>'), 'Must contain [A][B][C][D] bubbles');
  console.log('   ✓ Official OMR sheet HTML verified.');

  // 4. Test Provisional OMR Sheet Generation
  console.log('4. Testing provisional OMR sheet HTML generation...');
  const provOmrHtml = await pdfService.generateOmrSheetHtml(mockProvisionalCandidate as any);
  assert(provOmrHtml.includes('PRE-ISSUE COPY'), 'Provisional OMR must include warning banner');
  assert(provOmrHtml.includes('PROV-20260099'), 'Provisional OMR must include PROV- identifier');
  console.log('   ✓ Provisional OMR sheet HTML verified.');

  // 5. Test Bulk OMR and Roll Slip HTML
  console.log('5. Testing bulk HTML generators with page breaks...');
  const bulkOmrHtml = pdfService.generateBulkOmrSheetsHtml([
    { student: mockOfficialCandidate as any, qrDataUrl: '' },
    { student: mockProvisionalCandidate as any, qrDataUrl: '' },
  ]);
  assert(bulkOmrHtml.includes('page-break-after: always') || bulkOmrHtml.includes('page-break'), 'Bulk OMR must include CSS page breaks');
  assert(bulkOmrHtml.includes('AZMVS-2026-0001') && bulkOmrHtml.includes('PROV-20260099'), 'Bulk OMR must contain all candidates');

  const bulkSlipsHtml = pdfService.generateBulkRollSlipsHtml([
    { student: mockOfficialCandidate as any, qrDataUrl: '' },
    { student: mockProvisionalCandidate as any, qrDataUrl: '' },
  ]);
  assert(bulkSlipsHtml.includes('page-break-after: always') || bulkSlipsHtml.includes('page-break'), 'Bulk slips must include CSS page breaks');
  assert(bulkSlipsHtml.includes('AZMVS-2026-0001') && bulkSlipsHtml.includes('PROV-20260099'), 'Bulk slips must contain all candidates');
  console.log('   ✓ Bulk HTML generation verified.');

  console.log('--- ALL OMR AND ROLL SLIP TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
