import type { MeritPreviewRow } from './assessmentApi';

export type MeritSortField = 'rank' | 'total' | 'written' | 'studentName' | 'rollNumber';
export type SortDirection = 'asc' | 'desc';

export const meritSortOptions: ReadonlyArray<{ value: MeritSortField; label: string }> = [
  { value: 'rank', label: 'Merit rank' },
  { value: 'total', label: 'Total marks' },
  { value: 'written', label: 'Final written marks' },
  { value: 'studentName', label: 'Student name' },
  { value: 'rollNumber', label: 'Roll number' },
];

const naturalOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function finiteNumber(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

/** The current final source and saved assessment must agree before showing its weighted mark. */
export function meritWrittenContribution(row: MeritPreviewRow): number | null {
  const mark = finiteNumber(row.written.marks);
  const contribution = finiteNumber(row.totals.written);
  const maximum = row.written.maximumMarks;
  if (row.status === 'SOURCE_CHANGED' || !row.written.isFinal || mark === null || contribution === null
    || !Number.isFinite(maximum) || maximum <= 0) return null;
  // A changed draft remains INCOMPLETE rather than SOURCE_CHANGED. Validate that
  // its saved, two-decimal contribution still matches the current final mark.
  // This only suppresses stale display values; it never replaces server totals.
  return Math.abs(contribution - mark / maximum * 60) <= .005 + 1e-9 ? contribution : null;
}

function readyRank(row: MeritPreviewRow): number | null {
  return row.status === 'READY' && row.rank !== null && Number.isInteger(row.rank) && row.rank > 0
    ? row.rank : null;
}

function sortValue(row: MeritPreviewRow, field: MeritSortField): number | string | null {
  switch (field) {
    case 'rank': return readyRank(row);
    case 'total': {
      const rank = readyRank(row);
      // The server ranks exact totals before rounding the displayed score.
      // Inverting that rank orders scores without inventing ties from rounding.
      return rank !== null && finiteNumber(row.totals.total) !== null ? -rank : null;
    }
    case 'written': return row.written.isFinal ? finiteNumber(row.written.marks) : null;
    case 'studentName': return row.studentName.trim() || null;
    case 'rollNumber': return row.rollNumber?.trim() || null;
  }
}

/** Display ordering only: class groups and the server's original ranks stay intact. */
export function sortMeritRows(
  rows: readonly MeritPreviewRow[],
  field: MeritSortField,
  direction: SortDirection,
): MeritPreviewRow[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return rows.map((row, index) => ({ row, index, value: sortValue(row, field) }))
    .sort((a, b) => {
      // Distinct class labels remain distinct groups, including case/spacing aliases.
      const classOrder = naturalOrder.compare(a.row.className, b.row.className)
        || (a.row.className < b.row.className ? -1 : a.row.className > b.row.className ? 1 : 0);
      if (classOrder) return classOrder;
      // Missing values stay last even when the requested order is descending.
      if (a.value === null) return b.value === null ? a.index - b.index : 1;
      if (b.value === null) return -1;
      const comparison = typeof a.value === 'number' && typeof b.value === 'number'
        ? a.value - b.value : naturalOrder.compare(String(a.value), String(b.value));
      return comparison * multiplier || a.index - b.index;
    })
    .map(({ row }) => row);
}
