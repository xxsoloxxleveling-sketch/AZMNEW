import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// This register is deliberately separate from protected Student.testScore,
// ExaminationResult and DMC issuance. Only marks with publishedAt appear online.
export interface ProvisionalOmrMark {
  studentId: string;
  obtainedMarks: number;
  reviewCategory: string;
  identityStatus: string;
  paperVersionStatus: string;
  printedClassDisagrees: boolean;
  manualReviewRequired: boolean;
}

export async function findPublishedProvisionalMarks(studentIds: string[]): Promise<Map<string, ProvisionalOmrMark>> {
  if (studentIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<ProvisionalOmrMark[]>(Prisma.sql`
    SELECT "studentId", "obtainedMarks", "reviewCategory", "identityStatus",
      "paperVersionStatus", "printedClassDisagrees", "manualReviewRequired"
    FROM public."OmrProvisionalMark"
    WHERE "sessionReference" = '2026-V' AND "publishedAt" IS NOT NULL
      AND "studentId" IN (${Prisma.join(studentIds)})
  `);
  return new Map(rows.map((item) => [item.studentId, item]));
}

/** Numeric ordering across the filtered roster, with students lacking a mark last. */
export function sortProvisionalStudentIds(
  ids: string[],
  marks: ReadonlyMap<string, Pick<ProvisionalOmrMark, 'obtainedMarks'>>,
  direction: 'asc' | 'desc',
): string[] {
  return [...ids].sort((a, b) => {
    const first = marks.get(a)?.obtainedMarks;
    const second = marks.get(b)?.obtainedMarks;
    if (first === undefined && second === undefined) return a.localeCompare(b);
    if (first === undefined) return 1;
    if (second === undefined) return -1;
    const difference = direction === 'asc' ? first - second : second - first;
    return difference || a.localeCompare(b);
  });
}
