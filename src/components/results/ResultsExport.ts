import type { DemoStudentResult } from './ResultsTypes';

const columns: Array<{ label: string; value: (row: DemoStudentResult) => string | number | null; numeric?: boolean }> = [
  { label: 'Roll number', value: (row) => row.rollNumber },
  { label: 'Student name', value: (row) => row.studentName },
  { label: 'Class', value: (row) => row.className },
  { label: 'Examination', value: (row) => row.examinationName },
  { label: 'Marks obtained', value: (row) => row.obtainedMarks, numeric: true },
  { label: 'Maximum marks', value: (row) => row.maximumMarks, numeric: true },
  { label: 'Percentage', value: (row) => row.percentage, numeric: true },
  { label: 'Correct', value: (row) => row.correct, numeric: true },
  { label: 'Wrong', value: (row) => row.wrong, numeric: true },
  { label: 'Multiple', value: (row) => row.multiple, numeric: true },
  { label: 'Blank', value: (row) => row.blank, numeric: true },
  { label: 'Uncertain', value: (row) => row.uncertain, numeric: true },
  { label: 'Result status', value: (row) => row.status },
];

function safeText(value: string): string {
  return /^[\s\u0000-\u001f]*[=+@\-]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null, preserveIdentifier = false): string {
  if (value === null) return '';
  const identifier = typeof value === 'string' && preserveIdentifier && /^0\d+$/.test(value) ? `'${value}` : value;
  const normalized = typeof identifier === 'string' ? safeText(identifier) : identifier;
  const text = String(normalized);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadResultsCsv(rows: DemoStudentResult[], filename = 'azm-demo-results.csv'): void {
  const lines = [
    ['DEMO / NOT OFFICIAL', ...Array.from({ length: columns.length - 1 }, () => '')].map((value) => csvCell(value)).join(','),
    columns.map((column) => csvCell(column.label)).join(','),
    ...rows.map((row) => columns.map((column, index) => csvCell(column.value(row), index === 0)).join(',')),
  ];
  downloadBlob(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
}

export type ResultsExportCell = string | number | null;

export function downloadResultsTableCsv(
  title: string,
  headers: string[],
  rows: ResultsExportCell[][],
  filename: string,
  identifierColumns: number[] = [0],
): void {
  const lines = [
    [title, ...Array.from({ length: Math.max(0, headers.length - 1) }, () => '')].map((value) => csvCell(value)).join(','),
    headers.map((value) => csvCell(value)).join(','),
    ...rows.map((row) => headers.map((_, index) => csvCell(row[index] ?? null, identifierColumns.includes(index))).join(',')),
  ];
  downloadBlob(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function excelColumn(index: number): string {
  let result = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function sheetCell(value: string | number | null, ref: string): string {
  if (value === null) return `<c r="${ref}"/>`;
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(safeText(value))}</t></is></c>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function write16(view: DataView, offset: number, value: number): void { view.setUint16(offset, value, true); }
function write32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value, true); }

function zipStored(files: Array<{ name: string; contents: string }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const contents = encoder.encode(file.contents);
    const crc = crc32(contents);
    const local = new Uint8Array(30 + name.length + contents.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800);
    write16(localView, 8, 0); write16(localView, 10, 0); write16(localView, 12, 0);
    write32(localView, 14, crc); write32(localView, 18, contents.length); write32(localView, 22, contents.length);
    write16(localView, 26, name.length); write16(localView, 28, 0);
    local.set(name, 30); local.set(contents, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50); write16(centralView, 4, 20); write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800); write16(centralView, 10, 0); write16(centralView, 12, 0); write16(centralView, 14, 0);
    write32(centralView, 16, crc); write32(centralView, 20, contents.length); write32(centralView, 24, contents.length);
    write16(centralView, 28, name.length); write16(centralView, 30, 0); write16(centralView, 32, 0);
    write16(centralView, 34, 0); write16(centralView, 36, 0); write32(centralView, 38, 0); write32(centralView, 42, localOffset);
    central.set(name, 46); centralParts.push(central);
    localOffset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50); write16(endView, 4, 0); write16(endView, 6, 0);
  write16(endView, 8, files.length); write16(endView, 10, files.length); write32(endView, 12, centralSize);
  write32(endView, 16, localOffset); write16(endView, 20, 0);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadResultsXlsx(rows: DemoStudentResult[], filename = 'azm-demo-results.xlsx'): void {
  const rowValues = [
    ['DEMO / NOT OFFICIAL', ...Array.from({ length: columns.length - 1 }, () => '')],
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ];
  downloadWorkbook(rowValues, filename, 'Demo Results');
}

export function downloadResultsTableXlsx(
  title: string,
  headers: string[],
  rows: ResultsExportCell[][],
  filename: string,
  sheetName = 'Results',
): void {
  const rowValues: ResultsExportCell[][] = [
    [title, ...Array.from({ length: Math.max(0, headers.length - 1) }, () => '')],
    headers,
    ...rows.map((row) => headers.map((_, index) => row[index] ?? null)),
  ];
  downloadWorkbook(rowValues, filename, sheetName);
}

function downloadWorkbook(rowValues: ResultsExportCell[][], filename: string, sheetName: string): void {
  const sheetRows = rowValues.map((values, rowIndex) => {
    const cells = values.map((value, columnIndex) => sheetCell(value, `${excelColumn(columnIndex)}${rowIndex + 1}`)).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const files = [
    { name: '[Content_Types].xml', contents: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', contents: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', contents: workbook },
    { name: 'xl/_rels/workbook.xml.rels', contents: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', contents: worksheet },
  ];
  downloadBlob(zipStored(files), filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
