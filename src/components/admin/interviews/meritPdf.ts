import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { RowInput } from 'jspdf-autotable';
import type { MeritPreviewRow } from './assessmentApi';
import { meritWrittenContribution } from './meritViewModel';

export type MeritPdfOptions = {
  /** All filtered rows, in their selected display order, before pagination. */
  rows: readonly MeritPreviewRow[];
  policyVersion: string;
  roundTitle: string;
  sessionRef: string;
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
const statusLabels: Record<MeritPreviewRow['status'], string> = {
  READY: 'Ready', INCOMPLETE: 'Incomplete', ABSENT: 'Absent', SOURCE_CHANGED: 'Source changed',
};
const score = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '-' : value.toFixed(2);

// Normalise punctuation used by the UI for the PDF's built-in Latin font.
// Reject unsupported scripts explicitly rather than silently corrupting a name.
const text = (value: string) => {
  const clean = value.replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();
  if (/[^\u0020-\u007e\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2020\u2021\u2022\u2030\u2039\u203a\u20ac]/u.test(clean)) {
    throw new Error('PDF export cannot render some characters in the selected names or filters with the current font. Download CSV to preserve those characters, or select a narrower filter.');
  }
  return clean;
};
const metadata = (value: string, max = 240) => {
  const clean = text(value);
  return clean.length > max ? clean.slice(0, max - 3) + '...' : clean;
};

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
  [options.policyVersion, options.roundTitle, options.sessionRef, options.filters.className,
    options.filters.readiness, options.filters.search, options.filters.sortLabel,
    ...options.rows.flatMap(row => [row.studentName, row.className, row.rollNumber ?? '']),
  ].forEach(text);
  const logo = options.logoDataUrl ?? await brandLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: 'AZM.AIO Merit List - Private Provisional Review',
    subject: 'Filtered interview merit preview; written exam marks are final and verified.',
    author: 'AZM.AIO Scholarship & Examination Authority',
    creator: 'AZM.AIO Interview Management',
  });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = width - margin * 2;
  const readyCount = options.rows.filter(row => row.status === 'READY').length;
  const generatedLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(generatedAt) + ' PKT';
  const readiness = statusLabels[options.filters.readiness as MeritPreviewRow['status']] || options.filters.readiness || 'All candidates';
  const filterLines = [
    `Session: ${metadata(options.sessionRef || '-')} | ${metadata(options.roundTitle || 'Interview assessment')}`,
    `Class: ${metadata(options.filters.className || 'All classes (ranked separately)')} | Readiness: ${metadata(readiness)}`,
    `Sort: ${metadata(options.filters.sortLabel)} - ${options.filters.direction === 'asc' ? 'Ascending' : 'Descending'} within each class | Search: ${metadata(options.filters.search || 'None')}`,
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  const contextLines = filterLines.flatMap(line => doc.splitTextToSize(line, contentWidth - 8) as string[]);
  const ribbonHeight = contextLines.length * 3.5 + 5;
  const tableTop = 34 + ribbonHeight + 10;

  const drawHeader = () => {
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
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(width - margin - 55, 7, 55, 22, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text('Generated (Pakistan time)', width - margin - 52, 12);
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.text(generatedLabel, width - margin - 52, 17);
    doc.setFont('helvetica', 'normal');
    doc.text(`Candidates: ${options.rows.length} | Ready: ${readyCount}`, width - margin - 52, 23);
    doc.setDrawColor(...brand);
    doc.setLineWidth(.5);
    doc.line(margin, 31, width - margin, 31);
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, 34, contentWidth, ribbonHeight, 'F');
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.text(contextLines, margin + 4, 38, { lineHeightFactor: 1.34 });
    doc.setFontSize(7.1);
    doc.text('Scoring: written exam 60 + interview 20 + activities 10 + previous academics 5 + personality 5 = 100.', margin, tableTop - 3.5);
  };

  const body: RowInput[] = options.rows.map(row => {
    const writtenFinal = row.written.isFinal && row.written.marks !== null && Number.isFinite(row.written.marks);
    return [
      `${text(row.className)}\n${row.rank === null ? 'Unranked' : '#' + row.rank}`,
      `${text(row.studentName)}\n${text(row.rollNumber || 'No roll number')} | P${row.panel} / B${row.batch}`,
      writtenFinal ? score(row.written.marks) : '-',
      score(meritWrittenContribution(row)),
      score(row.totals.interview), score(row.totals.extracurricular),
      score(row.totals.academic), score(row.totals.personality),
      row.status === 'READY' ? score(row.totals.total) : '-',
      statusLabels[row.status] + (!writtenFinal ? '\nWritten unverified' : ''),
    ];
  });
  if (!body.length) body.push([{ content: 'No candidates match the selected filters.', colSpan: 10, styles: { halign: 'center', cellPadding: 6 } }]);

  autoTable(doc, {
    startY: tableTop,
    margin: { top: tableTop, right: margin, bottom: 24, left: margin },
    head: [[
      'Class / rank', 'Candidate / roll number\n(P = panel, B = batch)', 'Final written\n/100', 'Written\n/60', 'Interview\n/20',
      'Activities\n/10', 'Academics\n/5', 'Personality\n/5', 'Total\n/100', 'Readiness',
    ]],
    body,
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8, textColor: ink, valign: 'middle', lineColor: [219, 226, 234], lineWidth: .12, overflow: 'linebreak' },
    headStyles: { fillColor: brand, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.2, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28 }, 1: { cellWidth: 66 },
      2: { cellWidth: 21, halign: 'center' }, 3: { cellWidth: 21, halign: 'center' },
      4: { cellWidth: 23, halign: 'center' }, 5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 23, halign: 'center' },
      8: { cellWidth: 21, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: contentWidth - 243, fontSize: 7 },
    },
    willDrawPage: drawHeader,
    didParseCell: cell => {
      if (cell.section === 'body' && cell.column.index === 9 && options.rows[cell.row.index]) {
        cell.cell.styles.textColor = options.rows[cell.row.index].status === 'READY' ? [4, 120, 87] : [146, 64, 14];
      }
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(.2);
    doc.line(margin, height - 21, width - margin, height - 21);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.setFontSize(6.6);
    doc.text('Written exam marks shown are final and verified. Combined merit remains provisional; this review copy does not publish results or award scholarships.', margin, height - 17);
    doc.text('Ranks belong to each class and retain server-assigned ties. Filters and display order do not change merit ranks. A dash means unavailable, not zero.', margin, height - 13);
    doc.setFontSize(6.2);
    doc.text(`Policy: ${metadata(options.policyVersion, 120)} | Confidential administrative review`, margin, height - 7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 7, { align: 'right' });
  }
  return doc;
}

export async function exportMeritPdf(options: MeritPdfOptions): Promise<void> {
  const generatedAt = options.generatedAt ?? new Date();
  const doc = await buildMeritPdf({ ...options, generatedAt });
  const filenamePart = (value: string) => value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 45);
  const parts = ['AZM', filenamePart(options.sessionRef), 'Provisional-Merit', filenamePart(options.filters.className), pakistanDate(generatedAt)].filter(Boolean);
  doc.save(parts.join('-') + '.pdf');
}
