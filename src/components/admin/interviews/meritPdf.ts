import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { RowInput } from 'jspdf-autotable';
import type { MeritPreviewRow } from './assessmentApi';
import { meritGroupingLabel, meritRank } from './meritViewModel';
import type { MeritGrouping } from './meritViewModel';

export type MeritPdfOptions = {
  /** All filtered rows, in their selected display order, before pagination. */
  rows: readonly MeritPreviewRow[];
  policyVersion: string;
  roundTitle: string;
  sessionRef: string;
  grouping: MeritGrouping;
  filters: {
    className: string;
    readiness: string;
    search: string;
    sortLabel: string;
    direction: 'asc' | 'desc';
  };
  generatedAt?: Date;
  /** Allows a deterministic, local brand asset in export verification. */
  logoDataUrl?: string;
};

const brand: [number, number, number] = [24, 91, 157];
const ink: [number, number, number] = [30, 41, 59];
const muted: [number, number, number] = [71, 85, 105];
const categoryLabels: Record<string, string> = {
  GENERAL_MERIT: 'General Merit',
  FINANCIALLY_NEEDY: 'Financially Needy',
  ORPHAN: 'Orphan',
  PERSON_WITH_DISABILITY: 'Person with Disability',
};
const columnHeadings = ['Merit Rank', 'Roll No', 'Name', 'Father Name', 'Institute', 'Percentage Obtained', 'Scholarship Category'];

// Normalise punctuation used by the UI for the PDF's built-in Latin font.
// Reject unsupported scripts explicitly rather than silently corrupting a name.
const text = (value: string) => {
  const clean = value.normalize('NFC').replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();
  if (/[^\u0020-\u007e\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2020\u2021\u2022\u2030\u2039\u203a\u20ac]/u.test(clean)) {
    throw new Error('PDF export cannot render some characters in the selected records with the current font. Select a narrower filter.');
  }
  return clean;
};
const metadata = (value: string, max = 240) => {
  const clean = text(value);
  return clean.length > max ? clean.slice(0, max - 3) + '...' : clean;
};
const identity = (value: string | null | undefined) => text(value ?? '') || '-';
const category = (value: string | null | undefined) => {
  const stored = value?.trim();
  return stored ? identity(categoryLabels[stored] ?? stored.replace(/_/g, ' ')) : '-';
};
const percentage = (row: MeritPreviewRow) => row.status === 'READY' && row.totals.total != null && Number.isFinite(row.totals.total)
  ? row.totals.total.toFixed(2) + '%' : '-';

let logoPromise: Promise<string | undefined> | undefined;
async function brandLogo(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  logoPromise ??= (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/logo_cropped.png', { signal: controller.signal, cache: 'force-cache' });
      if (!response.ok) return undefined;
      const blob = await response.blob();
      return await new Promise<string | undefined>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(blob);
      });
    } catch {
      // The authority wordmark still brands the report if the optional image is unavailable.
      return undefined;
    } finally {
      window.clearTimeout(timeout);
    }
  })();
  return logoPromise;
}

function pakistanDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function buildMeritPdf(options: MeritPdfOptions): Promise<jsPDF> {
  const generatedAt = options.generatedAt ?? new Date();
  if (!Number.isFinite(generatedAt.getTime())) throw new Error('Unable to export PDF: the generation date is invalid.');
  [options.roundTitle, options.sessionRef, options.filters.className,
    ...options.rows.flatMap(row => [row.studentName, row.rollNumber ?? '', row.fatherName ?? '', row.institute ?? '', row.scholarshipCategory ?? '',
      ...(options.grouping === 'class' ? [row.className] : [])]),
  ].forEach(text);
  const logo = options.logoDataUrl ?? await brandLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: 'AZM.AIO Merit List - Private Provisional Review',
    subject: `${meritGroupingLabel(options.grouping)} - private provisional merit review.`,
    author: 'AZM.AIO Scholarship & Examination Authority',
    creator: 'AZM.AIO Interview Management',
  });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = width - margin * 2;
  const generatedLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(generatedAt) + ' PKT';
  const filterLines = [
    `Session: ${metadata(options.sessionRef || '-')} | ${metadata(options.roundTitle || 'Interview assessment')}`,
    `Merit grouping: ${meritGroupingLabel(options.grouping)}` + (options.filters.className ? ` | Class: ${metadata(options.filters.className)}` : ''),
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  const contextLines = filterLines.flatMap(line => doc.splitTextToSize(line, contentWidth - 8) as string[]);
  const ribbonHeight = contextLines.length * 3.5 + 5;
  const tableTop = 34 + ribbonHeight + 5;
  const headerPages = new Set<number>();

  const drawHeader = () => {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (headerPages.has(page)) return;
    headerPages.add(page);
    if (logo) {
      try {
        const image = doc.getImageProperties(logo);
        const scale = Math.min(18 / image.width, 21 / image.height);
        doc.addImage(logo, 'PNG', margin, 7, image.width * scale, image.height * scale, 'azm-merit-logo', 'FAST');
      } catch { /* Retain the text wordmark if the image cannot be decoded. */ }
    }
    doc.setTextColor(...brand);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.3);
    doc.text('AZM.AIO SCHOLARSHIP & EXAMINATION AUTHORITY', 35, 12.5);
    doc.setFontSize(11.6);
    doc.text('MERIT LIST', 35, 19);
    doc.setTextColor(...muted);
    doc.setFontSize(8.2);
    doc.text('PRIVATE PROVISIONAL REVIEW - NOT PUBLISHED', 35, 24.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text('Generated (Pakistan time)', width - margin, 12, { align: 'right' });
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.text(generatedLabel, width - margin, 17, { align: 'right' });
    doc.setDrawColor(...brand);
    doc.setLineWidth(.5);
    doc.line(margin, 31, width - margin, 31);
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, 34, contentWidth, ribbonHeight, 'F');
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.text(contextLines, margin + 4, 38, { lineHeightFactor: 1.34 });
  };

  const candidateRow = (row: MeritPreviewRow): RowInput => {
    const rank = meritRank(row, options.grouping);
    return [
      rank === null ? '-' : String(rank), identity(row.rollNumber), identity(row.studentName),
      identity(row.fatherName), identity(row.institute), percentage(row), category(row.scholarshipCategory),
    ];
  };
  const sections: Array<{ className?: string; rows: MeritPreviewRow[] }> = [];
  if (options.grouping === 'class') {
    // The caller supplies its selected order. Consecutive groups preserve that
    // order, including distinct class aliases, without sorting or renumbering.
    for (const row of options.rows) {
      const previous = sections.at(-1);
      if (previous?.className === row.className) previous.rows.push(row);
      else sections.push({ className: row.className, rows: [row] });
    }
  } else sections.push({ rows: [...options.rows] });
  if (!sections.length) sections.push({ rows: [] });

  let startY = tableTop;
  for (const section of sections) {
    const head: RowInput[] = [];
    if (section.className !== undefined) head.push([{
      content: `Class: ${identity(section.className)}`, colSpan: 7,
      styles: { fillColor: [226, 237, 249], textColor: brand, fontSize: 8.7, halign: 'left', cellPadding: 2.5 },
    }]);
    head.push(columnHeadings);
    const body: RowInput[] = section.rows.map(candidateRow);
    if (!body.length) body.push([{ content: 'No candidates match the selected filters.', colSpan: 7, styles: { halign: 'center', cellPadding: 6 } }]);
    autoTable(doc, {
      startY,
      margin: { top: tableTop, right: margin, bottom: 18, left: margin },
      head, body,
      theme: 'grid',
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      styles: { font: 'helvetica', fontSize: 8.1, cellPadding: 2, textColor: ink, valign: 'middle', lineColor: [219, 226, 234], lineWidth: .12, overflow: 'linebreak' },
      headStyles: { fillColor: brand, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.8, cellPadding: 2.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: brand },
        1: { cellWidth: 32, fontSize: 7.6 }, 2: { cellWidth: 45 }, 3: { cellWidth: 43 },
        4: { cellWidth: 65 }, 5: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: contentWidth - 237 },
      },
      willDrawPage: drawHeader,
    });
    startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(.2);
    doc.line(margin, height - 14, width - margin, height - 14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.setFontSize(6.6);
    doc.text('Private provisional review', margin, height - 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 8, { align: 'right' });
  }
  return doc;
}

export async function exportMeritPdf(options: MeritPdfOptions): Promise<void> {
  const generatedAt = options.generatedAt ?? new Date();
  const doc = await buildMeritPdf({ ...options, generatedAt });
  const filenamePart = (value: string) => value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 45);
  const parts = ['AZM', filenamePart(options.sessionRef), 'Provisional-Merit', options.grouping === 'overall' ? 'Overall' : 'By-Class', filenamePart(options.filters.className), pakistanDate(generatedAt)].filter(Boolean);
  doc.save(parts.join('-') + '.pdf');
}
