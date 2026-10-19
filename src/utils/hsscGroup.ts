/** Match the class aliases and group labels used by the PDF templates. */
export function getPrintableHsscGroup(student: { currentClass?: string | null; hsscGroup?: string | null }): string | null {
  const grade = (student.currentClass || '').trim();
  if (!/^(?:HSSC[-\s]?(?:I{1,2}|[12])(?:\s*\(Class\s+1[12](?:th)?\))?|(?:first|second|1st|2nd)\s+year|(?:Class\s+)?1[12](?:th)?(?:\s*\(HSSC[-\s]?I{1,2}\))?)$/i.test(grade)) return null;
  const value = (student.hsscGroup || '').trim();
  const options = ['Pre-Medical', 'Pre-Engineering', 'ICS', 'FA', 'I.Com', 'General Science'];
  return options.find(group => group.toLowerCase() === value.toLowerCase()) || 'Not specified';
}
