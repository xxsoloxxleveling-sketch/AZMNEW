import assert from 'node:assert/strict';
import test from 'node:test';
import { studentQuerySchema } from '../src/modules/students/students.schema';
import {
  buildStudentDirectoryTextCondition,
  buildStudentSchoolCondition,
} from '../src/modules/students/studentDirectoryFilters';

test('school filter is trimmed, bounded, and optional for existing student queries', () => {
  const parsed = studentQuerySchema.parse({
    schoolName: '  Abbottabad Public School  ',
    search: 'student 1',
    classLevel: 'CLASS_10',
    page: '2',
    limit: '20',
  });
  assert.equal(parsed.schoolName, 'Abbottabad Public School');
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 20);
  assert.equal(studentQuerySchema.parse({ page: '1' }).schoolName, undefined);
  assert.equal(studentQuerySchema.safeParse({ schoolName: 'x'.repeat(121) }).success, false);
});

test('dedicated school query filters the full database roster with case-insensitive substring matching', () => {
  assert.deepEqual(buildStudentSchoolCondition('  Govt High School  '), {
    schoolName: { contains: 'Govt High School', mode: 'insensitive' },
  });
  assert.equal(buildStudentSchoolCondition('   '), null);
  assert.equal(buildStudentSchoolCondition(undefined), null);
});

test('main student directory search includes school names and previous identifiers', () => {
  const condition = buildStudentDirectoryTextCondition('  Model School  ');
  assert.ok(condition);
  const matchedFields = Object.keys(condition.OR.reduce((result, term) => Object.assign(result, term), {}));
  assert.deepEqual(matchedFields.sort(), [
    'fullName',
    'rollNumber',
    'cnicOrBForm',
    'applicationNo',
    'fatherName',
    'schoolName',
  ].sort());
  assert.deepEqual(condition.OR.find((term) => 'schoolName' in term), {
    schoolName: { contains: 'Model School', mode: 'insensitive' },
  });
  assert.equal(buildStudentDirectoryTextCondition(' '), null);
});

test('combined school and student filters are independent AND clauses', () => {
  const search = buildStudentDirectoryTextCondition('Asad');
  const school = buildStudentSchoolCondition('Peshawar');
  const combined = [search, school].filter(Boolean);
  assert.equal(combined.length, 2);
  assert.deepEqual(combined[1], { schoolName: { contains: 'Peshawar', mode: 'insensitive' } });
  assert.equal(combined[0], search);
});
