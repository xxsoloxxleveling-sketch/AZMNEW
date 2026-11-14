export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function initials(name) { return String(name || 'Staff').trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase(); }
export function niceDate(date) {
  if (!date) return 'Date not set';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Date unavailable';
  return value.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
}
export function niceTime(date) {
  if (!date) return '—';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '—';
  return value.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' });
}
const paths = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  list: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h9M8 14h9M6 9h.01M6 14h.01"/>',
  arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="m3 3 18 18M10.6 5.2A10.2 10.2 0 0 1 12 5c6.5 0 10 7 10 7a14 14 0 0 1-4 4.7M6 6.4C3.4 8.1 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L3 9m0-6v6h6M4 13a8 8 0 0 0 14.5 4.5L21 15m0 6v-6h-6"/>',
  camera: '<path d="M14 4H9l-2 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="14" r="4"/>',
  flash: '<path d="M13 2 3 14h7l-1 8 12-13h-7l-1-7z"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5ZM22 9l-6 6m0-6 6 6"/>',
  mobile: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  wifi: '<path d="M2 8a15 15 0 0 1 20 0M5 11a11 11 0 0 1 14 0M8 14a6 6 0 0 1 8 0"/><circle cx="12" cy="18" r="1"/>',
  alert: '<path d="m10.3 3.9-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4m0 4h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
export function ic(name, size = 20) { return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.85" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`; }
export function chip(status) {
  const map = { OPEN:['open','OPEN'], PRE_OPEN:['pending','PRE-OPEN'], CLOSED:['closed','CLOSED'], CANCELLED:['bad','CANCELLED'], PRESENT:['good','PRESENT'], LATE:['good','LATE'], ABSENT:['bad','ABSENT'], NOT_MARKED:['pending','UNMARKED'], success:['good','CONFIRMED'], duplicate:['warn','ALREADY MARKED'], error:['bad','REJECTED'] };
  const [style,label] = map[status] || ['neutral',String(status||'UNKNOWN')];
  return `<span class="chip chip-${style}"><span class="chip-dot"></span>${esc(label)}</span>`;
}
export function metricBar(percentage) { const pct = Math.max(0,Math.min(100, Number(percentage)||0)); return `<div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${pct}%"></div></div>`; }
