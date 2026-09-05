import assert from 'node:assert/strict';
import { createStudentSchema, publicRegistrationSchema, uploadDocumentSchema } from '../src/modules/students/students.schema';

const walkIn = {
  fullName: 'Test Student', fatherName: 'Test Guardian', cnicOrBForm: '13101-1234567-1',
  dateOfBirth: '2010-05-05', address: 'Test Street', district: 'Mansehra', parentMobile: '03001234567',
  currentClass: 'BS', bsDepartment: 'Computer Science', bsSemester: '1', schoolName: 'Test College',
  emergencyContact: '03001234567', academicRecords: [{ examLevel: 'SSC', totalMarks: 1100, obtainedMarks: 990, percentage: 90 }],
};
assert(createStudentSchema.safeParse(walkIn).success, 'Staff can save an incomplete document checklist');
assert(!publicRegistrationSchema.safeParse(walkIn).success, 'Public registration must still require documents');
for (const docType of ['photo', 'bform', 'fatherCnic', 'dmc', 'dmc_2', 'domicile', 'income', 'paymentReceipt', 'signature']) {
  assert(uploadDocumentSchema.safeParse({ docType, fileData: 'data:image/png;base64,aGVsbG8=', fileName: 'test.png' }).success, `${docType} should be uploadable`);
}
assert(!uploadDocumentSchema.safeParse({ docType: '../signature', fileData: 'data:image/png;base64,aGVsbG8=' }).success);
assert(!uploadDocumentSchema.safeParse({ docType: 'signature', fileData: 'data:text/html;base64,aGVsbG8=' }).success);
assert(!uploadDocumentSchema.safeParse({ docType: 'income', contentType: 'application/pdf', fileData: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') }).success);
console.log('Admin registration validation passed: walk-in flexibility, strict public registration, all attachment types, path/type/size rejection.');
