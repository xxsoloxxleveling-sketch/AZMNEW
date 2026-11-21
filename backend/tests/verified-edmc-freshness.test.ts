import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFreshEdmcStudentSnapshot } from '../src/modules/students/verifiedEdmcPdf';

type StudentSnapshot = Parameters<typeof assertFreshEdmcStudentSnapshot>[0];

const issued: StudentSnapshot = {
  status: 'ACTIVE',
  fullName: 'Synthetic Candidate',
  fatherName: 'Synthetic Parent',
  rollNumber: 'AZM-2026-SYNTHETIC',
  applicationNo: 'APP-SYNTHETIC',
  currentClass: 'Class 6',
  schoolName: 'Synthetic School A',
  hsscGroup: null,
  bsDepartment: null,
  bsSemester: null,
  district: 'Abbottabad',
  registrationCentre: 'Synthetic Registration Centre',
  officeUse: { testCentre: 'Synthetic Test Centre A' },
};

function mustReject(current: StudentSnapshot | null) {
  assert.throws(
    () => assertFreshEdmcStudentSnapshot(issued, current),
    (error: unknown) =>
      error instanceof Error &&
      /student record changed while generating the E-DMC/i.test(error.message) &&
      (error as Error & { statusCode?: number }).statusCode === 409,
  );
}

test('E-DMC snapshot accepts a fresh student with the same printed fields', () => {
  assert.doesNotThrow(() => assertFreshEdmcStudentSnapshot(issued, { ...issued }));
  assert.doesNotThrow(() => assertFreshEdmcStudentSnapshot(issued, {
    ...issued, officeUse: { testCentre: issued.officeUse?.testCentre ?? null },
  }));
});

test('E-DMC refuses a student deleted, disabled, or without a current roll number', () => {
  mustReject(null);
  mustReject({ ...issued, status: 'INACTIVE' });
  mustReject({ ...issued, rollNumber: null });
});

test('E-DMC rejects any change to identity, school, class, centre, or other printed details', () => {
  const examples: Array<[string, StudentSnapshot]> = [
    ['name', { ...issued, fullName: 'Different Name' }],
    ['father', { ...issued, fatherName: 'Different Parent' }],
    ['roll', { ...issued, rollNumber: 'AZM-SYN-NEW' }],
    ['application', { ...issued, applicationNo: 'APP-SYN-NEW' }],
    ['class', { ...issued, currentClass: 'Class 7' }],
    ['school', { ...issued, schoolName: 'Synthetic School B' }],
    ['study group', { ...issued, hsscGroup: 'Pre-Medical' }],
    ['department', { ...issued, bsDepartment: 'Computing' }],
    ['semester', { ...issued, bsSemester: 'Fall' }],
    ['district', { ...issued, district: 'Different District' }],
    ['registration centre', { ...issued, registrationCentre: 'Different Registration Centre' }],
    ['test centre', { ...issued, officeUse: { testCentre: 'Synthetic Test Centre B' } }],
    ['removed centre details', { ...issued, officeUse: null }],
  ];
  for (const [label, current] of examples) {
    try {
      mustReject(current);
    } catch (error) {
      throw new Error('E-DMC freshness check failed for ' + label, { cause: error });
    }
  }
});
