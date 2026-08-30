import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { studentsService } from '../src/modules/students/students.service';

async function run() {
  // Trigger the existing development-only memory fallback; no live data is touched.
  await prisma.$queryRaw`SELECT 1`;

  const legacyPhoto = `data:image/jpeg;base64,${Buffer.alloc(195 * 1024, 1).toString('base64')}`;
  const legacyDocuments = JSON.stringify({
    bform: {
      name: 'legacy-bform.jpg',
      dataUrl: `data:image/jpeg;base64,${Buffer.alloc(20 * 1024, 2).toString('base64')}`,
    },
  });
  let student: any;
  for (let index = 0; index < 100; index++) {
    student = await prisma.student.create({
      data: {
        applicationNo: `APP-EGRESS-${index}`,
        qrToken: `QR-EGRESS-${index}`,
        photoUrl: legacyPhoto,
        uploadedDocsJson: legacyDocuments,
        fullName: `Egress Test Student ${index}`,
        fatherName: 'Test Guardian',
        gender: 'MALE',
        dateOfBirth: new Date('2008-01-01'),
        cnicOrBForm: `61101-${String(index).padStart(7, '0')}-0`,
        address: 'Test address',
        district: 'Mansehra',
        province: 'Khyber Pakhtunkhwa',
        parentMobile: '03000000000',
        currentClass: 'SSC-II',
        schoolName: 'Test School',
        boardOrUniversity: 'BISE',
        scholarshipCategory: 'GENERAL_MERIT',
        emergencyContact: '03000000000',
        emergencyRelation: 'Guardian',
      },
    });
  }

  const roster = await studentsService.getStudents({ page: 1, limit: 100 } as any);
  const rosterJson = JSON.stringify(roster);
  assert.equal(roster.students.length, 100);
  assert.ok(!rosterJson.includes('data:'));
  assert.ok(!rosterJson.includes('base64,'));
  assert.ok(Buffer.byteLength(rosterJson) < 250 * 1024);

  const detail = studentsService.formatStudentWithDocuments({
    ...student,
    uploadedDocsJson: student.uploadedDocsJson,
  });
  const detailJson = JSON.stringify(detail);
  assert.ok(!detailJson.includes('data:'));
  assert.ok(!detailJson.includes('base64,'));
  assert.equal(detail.photoUrl, null);
  assert.equal(detail.hasPhoto, true);
  assert.ok(detail.uploadedDocuments?.photo?.fileEndpoint);

  console.log('Egress remediation checks passed: 100-record lightweight roster and metadata-only detail responses.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
