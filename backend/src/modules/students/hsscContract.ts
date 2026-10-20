/** Shared by the API, capture forms and print renderers. No placement/filter rules live here. */
export const HSSC_GROUP_OPTIONS = [
  { value: 'Pre-Medical', label: 'Pre-Medical' },
  { value: 'Pre-Engineering', label: 'Pre-Engineering' },
  { value: 'ICS', label: 'Computer Science (ICS)' },
  { value: 'FA', label: 'Arts / Humanities (FA)' },
  { value: 'I.Com', label: 'Commerce (I.Com)' },
  { value: 'General Science', label: 'General Science' },
] as const;
export type HsscGroup = typeof HSSC_GROUP_OPTIONS[number]['value'];
export const STUDY_GROUP_REQUIRED = "Select the student's study group before saving.";
export const STUDY_GROUP_REVIEW = 'Study group needs verification';
const key = (value?: string | null) => (value || '').trim().toLowerCase()
  .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');

export type HsscClass = { kind: 'hssc'; year: 1 | 2 } | { kind: 'non-hssc' | 'conflicting'; year: null };
function yearAtom(value: string): 1 | 2 | null {
  if (/^(?:hssc[ -]?(?:i|1)|(?:first|1st) year|(?:class )?11(?:th)?)$/.test(value)) return 1;
  if (/^(?:hssc[ -]?(?:ii|2)|(?:second|2nd) year|(?:class )?12(?:th)?)$/.test(value)) return 2;
  return null;
}
export function classifyHsscClass(raw?: string | null): HsscClass {
  const value = key(raw);
  const year = yearAtom(value);
  if (year) return { kind: 'hssc', year };
  const pair = /^(.*?)\s*\(([^()]*)\)$/.exec(value);
  const parts = pair ? [pair[1].trim(), pair[2].trim()] : value.split(/\s*[/,;|+]\s*/);
  if (parts.length === 2) {
    const a = yearAtom(parts[0]), b = yearAtom(parts[1]);
    if (a && b) return a === b ? { kind: 'hssc', year: a } : { kind: 'conflicting', year: null };
  }
  return { kind: 'non-hssc', year: null };
}
export function getStudyClassLabel(raw?: string | null): string {
  const grade = classifyHsscClass(raw);
  return grade.kind === 'hssc' ? (grade.year === 1 ? 'First Year (HSSC-I)' : 'Second Year (HSSC-II)') : raw || '';
}

// Exact equivalents only. Pre-Engg is a retained public-form input convention;
// spacing/punctuation variants are reviewed equivalents of the six existing groups.
const aliases: Record<string, HsscGroup> = {
  'pre medical': 'Pre-Medical', 'pre engineering': 'Pre-Engineering',
  'pre_medical': 'Pre-Medical', 'pre_engineering': 'Pre-Engineering',
  'pre-engg': 'Pre-Engineering', 'pre engg': 'Pre-Engineering',
  // Observed HSSC-only input conventions in the 20 October read-only inventory.
  'computer science': 'ICS', 'science (computer science)': 'ICS',
  'science (pre-engineering)': 'Pre-Engineering', 'science ( pre-engineering)': 'Pre-Engineering',
  'science (maths/pre-engineering)': 'Pre-Engineering', 'science (maths/ preengineering)': 'Pre-Engineering',
  'computer science (ics)': 'ICS', 'arts / humanities (fa)': 'FA',
  'commerce (i.com)': 'I.Com', 'i.com.': 'I.Com', 'i com': 'I.Com',
};
const unverifiedDefaults = new Set(['science / pre-medical', 'science (biology/pre-medical)']);
export type GroupStatus = 'canonical' | 'alias' | 'missing' | 'unsupported' | 'conflicting' | 'unverified-default' | 'not-applicable';
export type StudyGroupResolution = { status: GroupStatus; group: HsscGroup | null; label: string | null; ready: boolean };
const equivalent = (value: string): HsscGroup | null => {
  const candidate = HSSC_GROUP_OPTIONS.find(o => key(o.value) === value)?.value ||
    (Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] : null);
  return HSSC_GROUP_OPTIONS.some(o => o.value === candidate) ? candidate as HsscGroup : null;
};
export function resolveHsscGroup(student: { currentClass?: string | null; hsscGroup?: string | null }): StudyGroupResolution {
  const grade = classifyHsscClass(student.currentClass);
  const unresolved = (status: GroupStatus): StudyGroupResolution => ({ status, group: null, label: STUDY_GROUP_REVIEW, ready: false });
  if (grade.kind === 'conflicting') return unresolved('conflicting');
  if (grade.kind !== 'hssc') return { status: 'not-applicable', group: null, label: null, ready: true };
  const value = key(student.hsscGroup);
  if (!value) return unresolved('missing');
  if (unverifiedDefaults.has(value)) return unresolved('unverified-default');
  const group = equivalent(value);
  if (group) return { group, label: HSSC_GROUP_OPTIONS.find(o => o.value === group)!.label,
    status: HSSC_GROUP_OPTIONS.some(o => key(o.value) === value) ? 'canonical' : 'alias', ready: true };
  const choices = value.split(/\s*[/,;|+]\s*/).map(equivalent).filter(Boolean);
  return unresolved(new Set(choices).size > 1 ? 'conflicting' : 'unsupported');
}
/** Screen-only unresolved label; finalized PDFs must call assertStudyGroupsReady first. */
export function getPrintableHsscGroup(student: { currentClass?: string | null; hsscGroup?: string | null }): string | null {
  return resolveHsscGroup(student).label;
}
export function studyGroupReadiness(students: Array<{ id: string; applicationNo?: string; currentClass?: string | null; hsscGroup?: string | null }>) {
  return {
    readyIds: students.filter(s => resolveHsscGroup(s).ready).map(s => s.id),
    unresolved: students.filter(s => !resolveHsscGroup(s).ready).map(s => ({ id: s.id, applicationNo: s.applicationNo,
      currentClass: s.currentClass, hsscGroup: s.hsscGroup, status: resolveHsscGroup(s).status })),
  };
}
export function assertStudyGroupsReady(students: Parameters<typeof studyGroupReadiness>[0]) {
  const details = studyGroupReadiness(students);
  if (details.unresolved.length) throw Object.assign(new Error(`${details.readyIds.length} ready to print. ${details.unresolved.length} students need a study group. Review groups before printing.`),
    { statusCode: 409, code: 'HSSC_GROUP_REVIEW_REQUIRED', details });
}
