import type { StaffDetailRecord, StaffPortalCredentials, TeacherExportRecord } from '../../../lib/mockApi';

export const escapePrint = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const issued = () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) + ' PKT';
const css = '@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#182534;font-size:11px}h1{font-size:20px;color:#185b9d}table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #cbd5e1;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}dl{display:grid;grid-template-columns:140px 1fr;gap:12px}dd{margin:0;overflow-wrap:anywhere}.notice{border-top:1px solid #cbd5e1;padding-top:14px}@media print{button{display:none}}';
function writePrint(win: Window, title: string, content: string, landscape = false) {
  win.opener = null;
  win.document.open();
  win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + escapePrint(title) + '</title><style>' + css + (landscape ? '@page{size:A4 landscape}' : '') + '</style></head><body><h1>' + escapePrint(title) + '</h1>' + content + '<button type="button" onclick="window.print()">Print / Save as PDF</button></body></html>');
  win.document.close();
  win.focus();
}
export function printTeacherPass(staff: StaffDetailRecord, credentials: StaffPortalCredentials): Window | null {
  // Open synchronously in the click handler; credentials never enter an API or URL.
  const win = window.open('', '_blank');
  if (!win) return null;
  const fields = [['Teacher Full Name',staff.fullName],['Designation',staff.role],['Portal Role','TEACHER'],['Login Email',credentials.email],['Temporary Password',credentials.temporaryPassword],['Staff ID',staff.id],['Date Issued',issued()],['Account Status','Active'],['Portal Login',window.location.origin + '/#login'],['Mobile Scanner',window.location.origin + '/#scan']];
  writePrint(win, 'AZM.AIO Teacher Access Pass', '<dl>' + fields.map(([label,value]) => '<dt>' + escapePrint(label) + '</dt><dd>' + escapePrint(value) + '</dd>').join('') + '</dl><p class="notice">This temporary password is shown only once. Keep this pass secure and provide it directly to the teacher.</p><p>The teacher should change the temporary password after first login.</p>');
  return win;
}
export function openTeacherDirectoryPrint(): Window | null { return window.open('', '_blank'); }
export function printTeacherDirectory(win: Window, teachers: TeacherExportRecord[]) {
  const headers = ['#','Name','Designation','Phone','Masked CNIC','Join Date','Default Salary','Staff Status','Portal Email','Account Status'];
  writePrint(win, 'AZM.AIO Teacher & Faculty Directory', '<p>Generated: ' + escapePrint(issued()) + ' · Total teachers: ' + teachers.length + '</p><table><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + teachers.map((s,i) => '<tr>' + [i+1,s.fullName,s.role,s.phone,s.cnic,s.joinDate.slice(0,10),s.salary,s.status,s.portalAccount?.email || 'Not created',s.portalAccount?.status || 'No account'].map(v => '<td>' + escapePrint(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>', true);
}
export function teacherDirectoryCsv(teachers: TeacherExportRecord[]): string {
  const cell = (value: unknown) => { let text = String(value ?? ''); if (/^[=+\-@\t\r\n]/.test(text) || /^[0-9]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
  const rows = [['Staff ID','Full Name','Designation','Phone','Masked CNIC','Date Joined','Staff Status','Default Salary Amount','Portal Email','Portal Account Status','Created Date'], ...teachers.map(s => [s.id,s.fullName,s.role,s.phone,s.cnic,s.joinDate,s.status,s.salary,s.portalAccount?.email || 'Not created',s.portalAccount?.status || 'No account',s.createdAt])];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
export function downloadTeacherDirectory(teachers: TeacherExportRecord[]) {
  const url = URL.createObjectURL(new Blob([teacherDirectoryCsv(teachers)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'AZMAIO_Teacher_Directory_' + new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()) + '.csv';
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
