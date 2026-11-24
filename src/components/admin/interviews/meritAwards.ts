import type { MeritAwardCode, MeritPreviewRow } from './assessmentApi';

export const meritAwardOptions: ReadonlyArray<{ value: MeritAwardCode; label: string }> = [
  { value: 'UMRAH_TICKET', label: 'Umrah Ticket' },
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'FULL_YEAR_SCHOLARSHIP', label: 'Full Year Scholarship' },
  { value: 'PARTIAL_SCHOLARSHIP', label: 'Partial Scholarship' },
  { value: 'EDUCATIONAL_VOUCHER', label: 'Educational Voucher' },
  { value: 'CASH_PRIZE_3000', label: '3000-Cash Prize' },
  { value: 'CASH_PRIZE_5000', label: '5000-Cash Prize' },
];

const registrationLabels: Record<string, string> = {
  GENERAL_MERIT: 'General Merit', FINANCIALLY_NEEDY: 'Financially Needy',
  ORPHAN: 'Orphan', PERSON_WITH_DISABILITY: 'Person with Disability',
};

export function meritRegistrationLabel(value: string | null | undefined): string {
  const stored = value?.trim();
  return stored ? registrationLabels[stored] ?? stored.replace(/_/g, ' ') : '-';
}

export function meritAwardLabel(value: MeritAwardCode | null | undefined): string {
  return meritAwardOptions.find(option => option.value === value)?.label ?? '-';
}

/** A registration category never constitutes an awarded scholarship. */
export function meritScholarshipLabel(row: Pick<MeritPreviewRow, 'scholarshipCategory' | 'meritAward'>): string {
  return meritAwardLabel(row.meritAward?.awardCode);
}
