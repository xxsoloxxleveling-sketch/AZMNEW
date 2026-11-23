import type { MeritPreviewRow } from './assessmentApi';

export type MeritSortField = 'rank' | 'total' | 'written' | 'studentName' | 'rollNumber';
export type SortDirection = 'asc' | 'desc';
export type MeritGrouping = 'overall' | 'class';

export const meritGroupingLabel = (grouping: MeritGrouping): string =>
  grouping === 'overall' ? 'All classes together' : 'Separate by class';

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

/** Only the selected server-provided rank is authoritative; class rank is never an overall fallback. */
export function meritRank(row: MeritPreviewRow, grouping: MeritGrouping): number | null {
  const rank = grouping === 'overall' ? row.overallRank : row.rank;
  return row.status === 'READY' && rank != null && Number.isInteger(rank) && rank > 0 ? rank : null;
}

function sortValue(row: MeritPreviewRow, field: MeritSortField, grouping: MeritGrouping): number | string | null {
  switch (field) {
    case 'rank': return meritRank(row, grouping);
    case 'total': return meritRank(row, grouping) !== null ? finiteNumber(row.totals.total) : null;
    case 'written': return row.written.isFinal ? finiteNumber(row.written.marks) : null;
    case 'studentName': return row.studentName.trim() || null;
    case 'rollNumber': return row.rollNumber?.trim() || null;
  }
}

function classOrder(left: string, right: string): number {
  return naturalOrder.compare(left, right) || (left < right ? -1 : left > right ? 1 : 0);
}

/** Display grouping and ordering never recalculate ranks or change source rows. */
export function sortMeritRows(
  rows: readonly MeritPreviewRow[],
  field: MeritSortField,
  direction: SortDirection,
  grouping: MeritGrouping = 'overall',
): MeritPreviewRow[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return rows.map((row, index) => ({ row, index, value: sortValue(row, field, grouping), rank: meritRank(row, grouping) }))
    .sort((a, b) => {
      if (grouping === 'class') {
        const groupOrder = classOrder(a.row.className, b.row.className);
        if (groupOrder) return groupOrder;
      }
      // Missing values stay last even when the requested order is descending.
      if (a.value === null) return b.value === null ? a.index - b.index : 1;
      if (b.value === null) return -1;
      const comparison = typeof a.value === 'number' && typeof b.value === 'number'
        ? a.value - b.value : naturalOrder.compare(String(a.value), String(b.value));
      if (comparison) return comparison * multiplier;
      if (field === 'total' && a.rank !== null && b.rank !== null) {
        // The selected server rank retains exact-score distinctions lost when
        // display totals were rounded. Class ranks are compared only inside
        // their class group; overall ranks are compared across the full list.
        const exactScoreOrder = b.rank - a.rank;
        if (exactScoreOrder) return exactScoreOrder * multiplier;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}
