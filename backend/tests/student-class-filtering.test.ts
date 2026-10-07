import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { studentsService, buildStudentClassWhere } from '../src/modules/students/students.service';

async function runStudentClassFilteringTests() {
  console.log('🚀 Running Student Class Filtering & Normalization Test Suite...\n');

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

  // --- PART 1: Unit tests for buildStudentClassWhere helper ---
  console.log('--- Part 1: buildStudentClassWhere Helper Logic ---');

  const nullResult = buildStudentClassWhere(null);
  assertTest(nullResult === null, 'null classLevel returns null');

  const allResult = buildStudentClassWhere('ALL');
  assertTest(allResult === null, "'ALL' classLevel returns null");

  const hssc1Where = buildStudentClassWhere('HSSC_1');
  assertTest(Array.isArray(hssc1Where?.OR) && hssc1Where.OR.length > 0, 'HSSC_1 generates OR conditions');
  const hssc1Aliases = hssc1Where.OR.map((o: any) => o.currentClass.equals);
  assertTest(
    hssc1Aliases.includes('1st Year') &&
      hssc1Aliases.includes('First Year') &&
      hssc1Aliases.includes('HSSC-I (Class 11th)') &&
      hssc1Aliases.includes('Class 11th (HSSC-I)'),
    'HSSC_1 contains all 1st Year aliases'
  );

  const legacy1stYearWhere = buildStudentClassWhere('1st Year');
  assertTest(
    JSON.stringify(legacy1stYearWhere) === JSON.stringify(hssc1Where),
    "Legacy '1st Year' maps to identical aliases as 'HSSC_1'"
  );

  const hssc2Where = buildStudentClassWhere('HSSC_2');
  assertTest(Array.isArray(hssc2Where?.OR) && hssc2Where.OR.length > 0, 'HSSC_2 generates OR conditions');
  const hssc2Aliases = hssc2Where.OR.map((o: any) => o.currentClass.equals);
  assertTest(
    hssc2Aliases.includes('2nd Year') &&
      hssc2Aliases.includes('Second Year') &&
      hssc2Aliases.includes('HSSC-II (Class 12th)') &&
      hssc2Aliases.includes('Class 12th (HSSC-II)'),
    'HSSC_2 contains all 2nd Year aliases'
  );

  const legacy2ndYearWhere = buildStudentClassWhere('2nd Year');
  assertTest(
    JSON.stringify(legacy2ndYearWhere) === JSON.stringify(hssc2Where),
    "Legacy '2nd Year' maps to identical aliases as 'HSSC_2'"
  );

  // Cross-contamination prevention
  assertTest(!hssc1Aliases.some((a: string) => a.includes('12') || a.includes('2nd')), 'HSSC_1 contains NO 2nd Year / 12th aliases');
  assertTest(!hssc2Aliases.some((a: string) => a.includes('11') || a.includes('1st')), 'HSSC_2 contains NO 1st Year / 11th aliases');

  const ssc1Where = buildStudentClassWhere('CLASS_9');
  const ssc2Where = buildStudentClassWhere('CLASS_10');
  const ssc1Aliases = ssc1Where.OR.map((o: any) => o.currentClass.equals);
  const ssc2Aliases = ssc2Where.OR.map((o: any) => o.currentClass.equals);
  assertTest(!ssc1Aliases.some((a: string) => a.includes('10')), 'CLASS_9 contains NO Class 10 aliases');
  assertTest(!ssc2Aliases.some((a: string) => a.includes('9')), 'CLASS_10 contains NO Class 9 aliases');

  // --- PART 2: Database integration & query isolation tests ---
  console.log('\n--- Part 2: Database Query & Filter Integration ---');

  const testIdsToClean: string[] = [];
  const testSuffix = Math.floor(1000000 + Math.random() * 9000000); // 7 digits
  const searchTag = `CLSFILT${testSuffix}`;

  try {
    const fixtureDefs = [
      // 1st Year variants (4 students)
      { name: `${searchTag} Cand1st-A`, classVal: '1st Year', gender: 'MALE', status: 'ACTIVE' },
      { name: `${searchTag} Cand1st-B`, classVal: 'First Year', gender: 'FEMALE', status: 'ACTIVE' },
      { name: `${searchTag} Cand1st-C`, classVal: 'HSSC-I (Class 11th)', gender: 'MALE', status: 'INACTIVE' },
      { name: `${searchTag} Cand1st-D`, classVal: 'Class 11th (HSSC-I)', gender: 'FEMALE', status: 'ACTIVE' },
      // 2nd Year variants (4 students)
      { name: `${searchTag} Cand2nd-A`, classVal: '2nd Year', gender: 'FEMALE', status: 'ACTIVE' },
      { name: `${searchTag} Cand2nd-B`, classVal: 'Second Year', gender: 'MALE', status: 'ACTIVE' },
      { name: `${searchTag} Cand2nd-C`, classVal: 'HSSC-II (Class 12th)', gender: 'FEMALE', status: 'ACTIVE' },
      { name: `${searchTag} Cand2nd-D`, classVal: 'Class 12th (HSSC-II)', gender: 'MALE', status: 'INACTIVE' },
      // Class 9 & Class 10
      { name: `${searchTag} CandNine-A`, classVal: 'SSC-I (Class 9th)', gender: 'MALE', status: 'ACTIVE' },
      { name: `${searchTag} CandTen-A`, classVal: 'SSC-II (Class 10th)', gender: 'FEMALE', status: 'ACTIVE' },
    ];

    for (let i = 0; i < fixtureDefs.length; i++) {
      const def = fixtureDefs[i];
      const created = await prisma.student.create({
        data: {
          applicationNo: `APP-${searchTag}-${i}`,
          fullName: def.name,
          fatherName: 'Father Test',
          gender: def.gender as any,
          dateOfBirth: new Date('2008-01-01'),
          cnicOrBForm: `99999${testSuffix}${i}`,
          address: 'Test Address',
          district: 'Abbottabad',
          province: 'Khyber Pakhtunkhwa',
          parentMobile: '0300-1111111',
          currentClass: def.classVal,
          schoolName: 'Test School',
          boardOrUniversity: 'BISE Abbottabad',
          scholarshipCategory: 'GENERAL_MERIT',
          emergencyContact: '0300-1111111',
          emergencyRelation: 'Father',
          qrToken: `QR-${searchTag}-${i}`,
          status: def.status as any,
        },
      });
      testIdsToClean.push(created.id);
    }

    // 1. Query HSSC_1
    const resHssc1 = await studentsService.getStudents({
      classLevel: 'HSSC_1',
      search: searchTag,
      limit: 100,
    });
    assertTest(resHssc1.pagination.total === 4, `HSSC_1 returns exactly 4 students across all 1st year aliases (got ${resHssc1.pagination.total})`);
    assertTest(
      resHssc1.students.every((s: any) =>
        ['1st Year', 'First Year', 'HSSC-I (Class 11th)', 'Class 11th (HSSC-I)'].includes(s.currentClass)
      ),
      'HSSC_1 students all have 1st Year class values'
    );
    assertTest(
      !resHssc1.students.some((s: any) => s.fullName.includes('Cand2nd') || s.fullName.includes('CandNine') || s.fullName.includes('CandTen')),
      'HSSC_1 contains NO 2nd Year or SSC students'
    );

    // 2. Query legacy "1st Year" filter key
    const resLegacy1st = await studentsService.getStudents({
      classLevel: '1st Year',
      search: searchTag,
      limit: 100,
    });
    assertTest(resLegacy1st.pagination.total === 4, `Legacy '1st Year' filter key returns all 4 students (got ${resLegacy1st.pagination.total})`);

    // 3. Query HSSC_2
    const resHssc2 = await studentsService.getStudents({
      classLevel: 'HSSC_2',
      search: searchTag,
      limit: 100,
    });
    assertTest(resHssc2.pagination.total === 4, `HSSC_2 returns exactly 4 students across all 2nd year aliases (got ${resHssc2.pagination.total})`);
    assertTest(
      resHssc2.students.every((s: any) =>
        ['2nd Year', 'Second Year', 'HSSC-II (Class 12th)', 'Class 12th (HSSC-II)'].includes(s.currentClass)
      ),
      'HSSC_2 students all have 2nd Year class values'
    );
    assertTest(
      !resHssc2.students.some((s: any) => s.fullName.includes('Cand1st') || s.fullName.includes('CandNine') || s.fullName.includes('CandTen')),
      'HSSC_2 contains NO 1st Year or SSC students'
    );

    // 4. Query legacy "2nd Year" filter key
    const resLegacy2nd = await studentsService.getStudents({
      classLevel: '2nd Year',
      search: searchTag,
      limit: 100,
    });
    assertTest(resLegacy2nd.pagination.total === 4, `Legacy '2nd Year' filter key returns all 4 students (got ${resLegacy2nd.pagination.total})`);

    // 5. Query CLASS_9 and CLASS_10 isolation
    const resClass9 = await studentsService.getStudents({
      classLevel: 'CLASS_9',
      search: searchTag,
      limit: 100,
    });
    assertTest(resClass9.pagination.total === 1 && resClass9.students[0].currentClass === 'SSC-I (Class 9th)', 'CLASS_9 returns only Class 9');

    const resClass10 = await studentsService.getStudents({
      classLevel: 'CLASS_10',
      search: searchTag,
      limit: 100,
    });
    assertTest(resClass10.pagination.total === 1 && resClass10.students[0].currentClass === 'SSC-II (Class 10th)', 'CLASS_10 returns only Class 10');

    // 6. Multi-filter combination: class + gender
    const resHssc1Female = await studentsService.getStudents({
      classLevel: 'HSSC_1',
      gender: 'FEMALE' as any,
      search: searchTag,
      limit: 100,
    });
    assertTest(resHssc1Female.pagination.total === 2, `HSSC_1 + FEMALE returns exactly 2 students (got ${resHssc1Female.pagination.total})`);

    // 7. Multi-filter combination: class + status
    const resHssc1Inactive = await studentsService.getStudents({
      classLevel: 'HSSC_1',
      status: 'INACTIVE' as any,
      search: searchTag,
      limit: 100,
    });
    assertTest(resHssc1Inactive.pagination.total === 1, `HSSC_1 + INACTIVE returns exactly 1 student (got ${resHssc1Inactive.pagination.total})`);

    // 8. Server-side pagination with class filtering
    const page1 = await studentsService.getStudents({
      classLevel: 'HSSC_1',
      search: searchTag,
      page: 1,
      limit: 2,
    });
    assertTest(page1.pagination.total === 4, `Pagination total is 4 (got ${page1.pagination.total})`);
    assertTest(page1.students.length === 2, `Page 1 returned limit=2 items (got ${page1.students.length})`);

    const page2 = await studentsService.getStudents({
      classLevel: 'HSSC_1',
      search: searchTag,
      page: 2,
      limit: 2,
    });
    assertTest(page2.students.length === 2, `Page 2 returned limit=2 items (got ${page2.students.length})`);
    const page1Ids = new Set(page1.students.map((s: any) => s.id));
    const page2Ids = new Set(page2.students.map((s: any) => s.id));
    const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
    assertTest(intersection.length === 0, 'Page 1 and Page 2 contain mutually disjoint items');

  } finally {
    console.log('\n--- Cleanup: Removing test records ---');
    if (testIdsToClean.length > 0) {
      await prisma.feeRecord.deleteMany({ where: { studentId: { in: testIdsToClean } } });
      await prisma.studentDocument.deleteMany({ where: { studentId: { in: testIdsToClean } } }).catch(() => {});
      await prisma.student.deleteMany({ where: { id: { in: testIdsToClean } } });
      console.log(`Cleaned up ${testIdsToClean.length} test fixture(s).`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Class Filtering Tests: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStudentClassFilteringTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
