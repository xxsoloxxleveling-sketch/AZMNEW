import { pdfService } from '../src/modules/documents/pdf.service';
import { supabaseStorage } from '../src/lib/supabaseStorage';
import { studentsService } from '../src/modules/students/students.service';

async function runTests() {
  console.log('🚀 Running Storage & PDF Reliability Integration Tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, detail || '');
      testsFailed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Purge All Data includes student-documents
  // -------------------------------------------------------------
  console.log('--- 1. Testing Storage Purge Bucket Inclusions ---');

  const emptyBucketCalls: string[] = [];
  const originalEmptyBucket = supabaseStorage.emptyBucket;
  supabaseStorage.emptyBucket = async (bucket: any) => {
    emptyBucketCalls.push(bucket);
    return true;
  };

  try {
    const purgeResult = await studentsService.purgeAllData();
    assert(purgeResult.success === true, 'purgeAllData executes successfully');
    assert(emptyBucketCalls.includes('student-photos'), 'purgeAllData includes student-photos bucket');
    assert(emptyBucketCalls.includes('qr-codes'), 'purgeAllData includes qr-codes bucket');
    assert(emptyBucketCalls.includes('registration-pdfs'), 'purgeAllData includes registration-pdfs bucket');
    assert(emptyBucketCalls.includes('student-documents'), 'purgeAllData includes student-documents bucket (fixed omission)');
  } finally {
    supabaseStorage.emptyBucket = originalEmptyBucket;
  }

  // -------------------------------------------------------------
  // Test 2: Student Photos Bucket Privacy & Signed URL Generation
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Student Photos Bucket Privacy & Access URLs ---');

  const testPhotoPath = `test_cand_${Date.now()}/photo.jpg`;
  const accessUrl = await supabaseStorage.getFileAccessUrl('student-photos', testPhotoPath);
  assert(
    typeof accessUrl === 'string' && accessUrl.length > 0,
    'getFileAccessUrl returns a valid URL string for student-photos'
  );
  console.log(`  Sample Access URL for student-photos: ${accessUrl.slice(0, 80)}...`);

  // -------------------------------------------------------------
  // Test 3: PDF Generation Concurrency Queue (3 Rapid Concurrent Requests)
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing PDF Generation Concurrency Queue (3 Quick Successive Requests) ---');

  const sampleStudentA = {
    applicationNo: 'APP-TEST-CONCURRENCY-1',
    rollNumber: 'AZMVS-2026-0001',
    fullName: 'Candidate Alpha',
    fatherName: 'Father Alpha',
    gender: 'MALE',
    dateOfBirth: '2008-05-15',
    age: 16,
    cnicOrBForm: '13503-1111111-1',
    address: 'Mansehra City',
    district: 'Mansehra',
    province: 'Khyber Pakhtunkhwa',
    parentMobile: '0300-1111111',
    currentClass: 'SSC-I (Class 9th)',
    schoolName: 'Public High School Mansehra',
    scholarshipCategory: 'GENERAL_MERIT',
    academicRecords: [{ examLevel: 'Middle', boardOrUni: 'BISE', totalMarks: 1100, obtainedMarks: 950 }],
  };

  const sampleStudentB = {
    ...sampleStudentA,
    applicationNo: 'APP-TEST-CONCURRENCY-2',
    rollNumber: 'AZMVS-2026-0002',
    fullName: 'Candidate Beta',
    cnicOrBForm: '13503-2222222-2',
    currentClass: 'SSC-II (Class 10th)',
  };

  const sampleStudentC = {
    ...sampleStudentA,
    applicationNo: 'APP-TEST-CONCURRENCY-3',
    rollNumber: 'AZMVS-2026-0003',
    fullName: 'Candidate Gamma',
    cnicOrBForm: '13503-3333333-3',
    currentClass: 'HSSC-I (1st Year)',
  };

  const htmlA = pdfService.generateStudentRegistrationHtml(sampleStudentA);
  const htmlB = pdfService.generateStudentRegistrationHtml(sampleStudentB);
  const htmlC = pdfService.generateStudentRegistrationHtml(sampleStudentC);

  console.log('  Firing 3 PDF generation requests concurrently via Promise.all...');
  const startTime = Date.now();

  const [pdfBufferA, pdfBufferB, pdfBufferC] = await Promise.all([
    pdfService.generatePdfFromHtml(htmlA),
    pdfService.generatePdfFromHtml(htmlB),
    pdfService.generatePdfFromHtml(htmlC),
  ]);

  const durationMs = Date.now() - startTime;
  console.log(`  All 3 PDFs generated in ${durationMs}ms without hanging or crashing.`);

  assert(
    Buffer.isBuffer(pdfBufferA) && pdfBufferA.length > 5000 && pdfBufferA.toString('utf-8', 0, 4) === '%PDF',
    'PDF 1 generated successfully as valid PDF binary buffer (>5KB)'
  );

  assert(
    Buffer.isBuffer(pdfBufferB) && pdfBufferB.length > 5000 && pdfBufferB.toString('utf-8', 0, 4) === '%PDF',
    'PDF 2 generated successfully as valid PDF binary buffer (>5KB)'
  );

  assert(
    Buffer.isBuffer(pdfBufferC) && pdfBufferC.length > 5000 && pdfBufferC.toString('utf-8', 0, 4) === '%PDF',
    'PDF 3 generated successfully as valid PDF binary buffer (>5KB)'
  );

  console.log(`\n========================================`);
  console.log(`Storage & PDF Tests Completed: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Storage & PDF test execution failed:', err);
  process.exit(1);
});
