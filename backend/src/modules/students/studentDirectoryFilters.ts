// Shared, parameterized Prisma filters for the protected Students directory and its PDF export.
// School text is stored on Student records; partner institutions are not an authoritative join.
const SEARCHABLE_STUDENT_FIELDS = [
  'fullName',
  'rollNumber',
  'cnicOrBForm',
  'applicationNo',
  'fatherName',
  'schoolName',
] as const;

export function buildStudentDirectoryTextCondition(search?: string) {
  const value = (search ?? '').trim();
  if (!value) return null;
  return {
    OR: SEARCHABLE_STUDENT_FIELDS.map((field) => ({
      [field]: { contains: value, mode: 'insensitive' as const },
    })),
  };
}

export function buildStudentSchoolCondition(schoolName?: string) {
  const value = (schoolName ?? '').trim();
  if (!value) return null;
  return { schoolName: { contains: value, mode: 'insensitive' as const } };
}
