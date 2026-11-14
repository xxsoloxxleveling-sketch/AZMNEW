import { createAttendanceApi, ApiError, extractAttendanceQrToken, computeSessionMetrics } from './api.js';
import { LiveQrCamera, decodeQrPhoto } from './camera.js';
import { esc, initials, niceDate, niceTime, ic, chip, metricBar } from './ui.js';

const app = document.querySelector('#app');
const live = document.querySelector('#sr-status');
const origin = window.AZM_ATTENDANCE_CONFIG?.apiOrigin || '';
if (window.Capacitor?.isNativePlatform?.() && !origin) {
  const message = 'Set the approved HTTPS AZM.AIO backend origin in config.js before building the Android app.';
  app.innerHTML = `<div class="fatal"><h1>Server configuration required</h1><p>${esc(message)}</p></div>`;
  throw new Error(message);
}
let api;
try { api = createAttendanceApi({ origin }); }
catch (err) { app.innerHTML = `<div class="fatal"><h1>Server configuration error</h1><p>${esc(err.message)}</p></div>`; throw err; }

const state = {
  view: 'login', loading: false, busy: false, error: '', toast: '', online: navigator.onLine,
  user: null, sessions: [], sessionPage: 1, sessionHasMore: false, selected: null, stats: null,
  roster: [], rosterPage: 1, rosterPages: 1, rosterTotal: 0, search: '', filter: 'all',
  modal: null, modalError: '', scannerResult: null, scanBusy: false, cameraState: 'idle',
  autoAdvance: false, sound: true, haptic: true, torch: false, recent: [],
};
let camera = null;
let nativeScanBusy = false;
let nativeScanRun = 0;
const isNativeApp = () => Boolean(window.Capacitor?.isNativePlatform?.());
let searchTimer = null;
let continueTimer = null;
let activityGeneration = 0;

const title = session => String(session?.hallNameSnapshot || 'Examination hall');
const place = session => [session?.testCenterNameSnapshot, session?.roomNumberSnapshot].filter(Boolean).join(' · ') || 'Assigned examination room';
const safeMessage = error => error?.message || 'Something went wrong. No attendance was confirmed.';
const isAdmin = () => ['ADMIN', 'SUPER_ADMIN'].includes(state.user?.role);
const activeSession = () => state.selected && state.selected.isCurrent && state.selected.status === 'OPEN';

function announce(message) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = message; }); }
function clearToast() { state.toast = ''; const node = document.querySelector('#toast'); if (node) node.innerHTML = ''; }
function notify(message, variant = 'info') {
  state.toast = { message, variant, id: Date.now() };
  announce(message);
  const container = document.querySelector('#toast');
  if (container) container.innerHTML = `<div class="toast toast-${esc(variant)}">${ic(variant==='error'?'alert':'info',18)} <span>${esc(message)}</span><button class="icon-btn" data-action="dismiss-toast" aria-label="Dismiss message">${ic('x',16)}</button></div>`;
}
function button(action, label, classes='btn btn-outline', disabled=false, icon='') {
  return `<button type="button" class="${classes}" data-action="${esc(action)}" ${disabled?'disabled':''}>${icon?ic(icon,18):''}${label}</button>`;
}
function percent(v) { return `${Number(v || 0).toFixed(Number.isInteger(Number(v)) ? 0 : 1)}%`; }
function count(n) { return Number(n || 0).toLocaleString('en-PK'); }
function verifiedWord(status) { return status==='OPEN' ? 'ACTIVE SESSION' : status==='PRE_OPEN' ? 'NOT OPEN' : 'READ ONLY'; }
function seenSession(s) { return s && s.isCurrent && s.status==='OPEN'; }
function renderChrome() {
  const user = state.user;
  return `<div class="shell">
    <header class="topbar"><div class="topbar-inner">
      <div class="brand-horizontal"><div class="brand-mark">${ic('shield',23)}</div><div class="brand-text"><strong>ExamScan <span class="pro-mark">PRO</span></strong><small>AZM.AIO · ATTENDANCE OPERATIONS</small></div></div>
      <div class="topbar-actions"><span id="net-pill" class="net-pill ${state.online?'net-on':'net-off'}"><i></i>${state.online?'DEVICE ONLINE':'DEVICE OFFLINE'}</span><button class="avatar" data-action="account" title="Your account" aria-label="Account: ${esc(user?.name||'Staff')}">${esc(initials(user?.name))}</button></div>
    </div></header>
    <main id="content" class="app-content"></main>
    <nav class="bottomnav" aria-label="Primary navigation">
      ${navItem('exams','Exams','calendar')}${navItem('scanner','Scan QR','scan')}${navItem('roster','Roster','list')}${navItem('account','Account','users')}
    </nav>
    <div id="toast" class="toast-root" aria-live="polite"></div>
    <div id="modal-root"></div>
  </div>`;
}
function navItem(view,label,icon) {
  const selected = state.view===view;
  return `<button class="nav-item ${selected?'nav-active':''}" data-action="nav-${view}" aria-current="${selected?'page':'false'}">${ic(icon,21)}<span>${esc(label)}</span></button>`;
}
function renderLogin() {
  app.innerHTML = `<main class="login-screen">
    <div class="login-layout"><div class="login-intro">
      <div class="login-logo">${ic('shield',39)}<span class="login-secure">${ic('check',13)}</span></div>
      <div class="login-wordmark">ExamScan <span>PRO</span></div>
      <div class="portal-label">${ic('lock',12)} Faculty Examination Portal</div>
      <div class="session-label"><i></i> AUTHENTICATED ATTENDANCE WORKSPACE</div>
    </div>
    <section class="auth-card"><div class="auth-heading"><span class="auth-heading-icon">${ic('shield',22)}</span><div><h1>Staff sign in</h1><p>Use your AZM.AIO account to access attendance.</p></div><span class="secure-tag">SECURE<br/>ACCESS</span></div>
      <form id="login-form" autocomplete="on" novalidate>
        <label for="staff-email" class="form-label">${ic('users',14)} STAFF EMAIL</label>
        <div class="input-wrap"><input id="staff-email" name="email" type="email" inputmode="email" autocomplete="username" required placeholder="name@institution.edu.pk" /></div>
        <label for="staff-pass" class="form-label">${ic('lock',14)} PASSWORD</label>
        <div class="input-wrap"><input id="staff-pass" name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="Enter your password"/><button type="button" data-action="toggle-password" class="input-icon" aria-label="Show password">${ic('eye',19)}</button></div>
        ${state.error?`<div class="inline-error" role="alert">${ic('alert',17)} ${esc(state.error)}</div>`:''}
        <button class="btn btn-dark login-submit" type="submit" ${state.busy?'disabled':''}>${state.busy?'Authenticating…':`${ic('lock',18)} Access Attendance Workspace ${ic('arrow',18)}`}</button>
      </form>
      <p class="auth-footnote">${ic('info',16)} Only active Super Admin, Admin and Teacher accounts may sign in. There is no offline attendance queue.</p>
    </section>
    <div class="login-proof"><div>${ic('scan',19)}<span><b>OPTICAL READY</b><small>Signed QR verification</small></span></div><div>${ic('shield',19)}<span><b>SERVER VERIFIED</b><small>No unconfirmed marks</small></span></div></div>
    <div class="integrity-block"><div>${ic('shield',17)}<b>AUDIT &amp; INTEGRITY PROTOCOL</b></div><p>Hall-specific check-in. Your staff identity and the current examination attempt are validated by AZM.AIO. A scan is recorded only after server confirmation.</p></div>
    ${!isNativeApp()?'<p class="login-download-beta"><a href="./install.html">Download Android app (beta)</a><span>Native Google QR scanner · Staff QA build</span></p>':''}
    <p class="copyright">EXAMSCAN · SECURE EXAMINATION OPERATIONS</p></div>
  </main>`;
}
function sectionHeader(top,heading,sub) { return `<div class="section-heading"><span class="eyebrow"><i></i>${esc(top)}</span><h1>${esc(heading)}</h1>${sub?`<p>${esc(sub)}</p>`:''}</div>`; }
function sessionCard(s, featured=false) {
  const m = computeSessionMetrics(s);
  const open = seenSession(s);
  return `<article class="session-card ${featured?'session-featured':''}">
    <div class="session-topline"><div class="overline">${chip(s.status)}<span class="mono soft">ATTEMPT ${esc(s.attemptNumber??'—')}</span></div><span class="session-date">${ic('calendar',14)}${esc(niceDate(s.businessDate))}</span></div>
    <h2>${esc(title(s))}</h2><div class="session-place">${ic('grid',15)} ${esc(place(s))}</div>
    <div class="session-metrics"><div><strong>${count(m.present)}</strong><small>PRESENT</small></div><div><strong>${count(m.remaining)}</strong><small>UNMARKED</small></div><div><strong>${count(m.expected)}</strong><small>ROSTER</small></div><div class="session-percent"><strong>${percent(m.percent)}</strong><small>COMPLETION</small></div></div>
    ${metricBar(m.percent)}<div class="session-card-bottom"><span>${ic('shield',13)} ${open?'Server-verified, open for check-in':`Session ${String(s.status||'unknown').toLowerCase()} · marking disabled`}</span>${button('select-session',open?'Start scanning':'Review roster',`btn ${open?'btn-dark':'btn-light'} btn-small`,false,open?'scan':'list').replace('data-action="select-session"',`data-action="select-session" data-id="${esc(s.id)}"`)}</div>
  </article>`;
}
function renderExams() {
  const open = state.sessions.filter(s => s.status==='OPEN' && s.isCurrent);
  const future = state.sessions.filter(s => s.status==='PRE_OPEN');
  const closed = state.sessions.filter(s => s.status!=='OPEN'&&s.status!=='PRE_OPEN');
  const headline = state.user?.name?.trim().split(' ')[0] || 'Staff';
  return `<section class="page exams-page">
    <div class="welcome"><div>${sectionHeader('EXAMINATION OPERATIONS',`Good to see you, ${headline}`, 'Choose the correct Hall and examination attempt before marking anyone present.')}</div><button data-action="refresh-exams" class="small-outline">${ic('refresh',17)} Refresh</button></div>
    ${!state.online?`<div class="banner-warning">${ic('alert',18)} Device is offline. Attendance changes cannot be submitted.</div>`:''}
    <div class="stats-strip"><div class="statbox"><div class="stat-icon blue">${ic('grid',21)}</div><b>${count(state.sessions.length)}</b><small>CURRENT SESSIONS</small></div><div class="statbox"><div class="stat-icon green">${ic('scan',21)}</div><b>${count(open.length)}</b><small>OPEN NOW</small></div><div class="statbox"><div class="stat-icon slate">${ic('users',21)}</div><b>${count(open.reduce((a,s)=>a+computeSessionMetrics(s).expected,0))}</b><small>OPEN-HALL ROSTER</small></div></div>
    ${open.length?`<div class="list-section"><div class="list-title"><div><span class="eyebrow">LIVE INVIGILATION</span><h2>Active examination sessions</h2></div><span class="count-tag">${count(open.length)} OPEN</span></div><div class="session-grid">${open.map(s=>sessionCard(s,true)).join('')}</div></div>`:`<div class="empty-card">${ic('clock',30)}<h2>No OPEN sessions right now</h2><p>Only administrators can prepare and open Hall sessions in the main AZM.AIO portal. This app cannot create or open one.</p></div>`}
    ${future.length?`<div class="list-section"><div class="list-title"><div><span class="eyebrow">AWAITING ACCESS</span><h2>Prepared halls</h2></div><span class="count-tag">${future.length}</span></div><div class="session-grid">${future.map(s=>sessionCard(s)).join('')}</div></div>`:''}
    ${closed.length?`<div class="list-section"><div class="list-title"><div><span class="eyebrow">HISTORY / READ ONLY</span><h2>Closed or cancelled</h2></div></div><div class="session-grid">${closed.map(s=>sessionCard(s)).join('')}</div></div>`:''}
    ${state.sessionHasMore?`<div class="more-wrapper">${button('more-exams','Load more sessions','btn btn-outline',false,'plus')}</div>`:''}
    <p class="source-note">${ic('shield',15)} All Hall and attendance figures come from the AZM.AIO backend. No sample records are displayed.</p>
  </section>`;
}
function renderSessionHeading() {
  const s = state.selected;
  return `<div class="active-session-strip"><div><span class="eyebrow"><i></i>${verifiedWord(s?.status)}</span><h1>${esc(title(s))}</h1><p>${esc(place(s))} · Attempt ${esc(s?.attemptNumber||'—')} · ${esc(niceDate(s?.businessDate))}</p></div><button class="mini-action" data-action="nav-exams">${ic('back',16)} Halls</button></div>`;
}
function renderScanner() {
  const s=state.selected, m=computeSessionMetrics({stats:state.stats});
  if (!s) return `<section class="page">${sectionHeader('SELECT AN EXAM','Scan a signed QR','Choose an OPEN Hall first.')}${button('nav-exams','Choose a hall','btn btn-dark',false,'arrow')}</section>`;
  const open=activeSession();
  return `<section class="scan-page">
    <div class="scan-head">${renderSessionHeading()}<div class="scanner-summary"><div>${count(m.present)} <span>present</span></div><div>${count(m.remaining)} <span>remaining</span></div><strong>${percent(m.percent)}</strong></div></div>
    <div class="video-stage ${open?'':'video-disabled'} ${isNativeApp()?'google-native-stage':''}" id="video-stage">
      ${isNativeApp()?`<div class="google-native-note">${ic('scan',42)}<strong>Google Code Scanner</strong><span>Fast on-device QR decoding with auto-zoom. Tap the blue button to open Google's camera.</span></div>`:`<video id="camera-video" aria-label="Live camera preview for QR scanning" autoplay muted playsinline></video>`}
      <div class="video-grid"></div>
      <div class="video-controls"><span class="camera-signal"><span class="signal-dot"></span><span id="camera-label">OPTICAL STANDBY</span></span><div class="camera-buttons">${isNativeApp()?'':`<button class="control-btn" data-action="torch" id="torch-btn" title="Toggle torch" aria-label="Toggle torch">${ic('flash',18)}</button>`}<button class="control-btn ${state.sound?'enabled':''}" data-action="toggle-sound" aria-label="Toggle audio feedback">${ic(state.sound?'volume':'mute',18)}</button><button class="control-btn ${state.haptic?'enabled':''}" data-action="toggle-haptic" aria-label="Toggle haptic feedback">${ic('mobile',18)}</button></div></div>
      <div class="reticle"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span><div class="scan-line"></div></div>
      <div class="video-caption">${ic('scan',16)} ${isNativeApp()?'Tap below to launch Google Code Scanner':'Align the signed AZM.AIO roll-slip QR'}</div>
      ${!open?'<div class="camera-overlay"><strong>SCANNING DISABLED</strong><p>This Hall is not the current OPEN attempt.</p></div>':''}
    </div>
    <div class="scan-controls">${button('toggle-camera',open?(isNativeApp()?'Open Google camera':'Start camera'):'Scanning unavailable',`btn ${open?'btn-blue':'btn-light'} primary-scanner`,!open,'camera')}${isNativeApp()?'':`<label class="photo-upload" title="Read QR from an existing photo">${ic('camera',18)} <span>Scan photo</span><input id="qr-photo" type="file" accept="image/*" ${open?'':'disabled'} /></label>`}</div>
    <div class="tracking-card"><div class="tracking-row"><span>${ic('shield',16)} <b id="scan-progress-label">${count(m.present)} present · ${count(m.remaining)} unmarked</b></span><strong id="scan-percentage">${percent(m.percent)}</strong></div><div id="scan-bar">${metricBar(m.percent)}</div></div>
    <div id="scan-feedback">${renderScanFeedback()}</div>
    <div class="scan-option"><div>${ic('refresh',21)}<div><b>Continuous scanning</b><small>Resume after server-confirmed scans</small></div></div><label class="switch"><input id="auto-advance" type="checkbox" ${state.autoAdvance?'checked':''} ${open?'':'disabled'}/><span></span></label></div>
    <div class="scan-option"><div>${ic('users',21)}<div><b>Need to verify manually?</b><small>Search the Hall roster by name or roll number</small></div></div><button class="small-outline" data-action="nav-roster">Roster ${ic('chevron',15)}</button></div>
    <div class="scan-note">${ic('info',16)} Camera decoding is not attendance confirmation. Only a successful server response records attendance. Nothing is queued offline.</div>
  </section>`;
}
function renderScanFeedback() {
  const result=state.scannerResult;
  if (!result) return `<div class="scan-empty"><span class="scan-empty-icon">${ic('scan',24)}</span><div><h2>Ready for verification</h2><p>A confirmed candidate record appears here after the AZM.AIO server responds.</p></div></div>`;
  const {type,student,message,time}=result;
  const symbol=type==='success'?'check':type==='duplicate'?'clock':'alert';
  return `<article class="result-card result-${esc(type)}"><div class="result-top">${chip(type)}<span>${ic('clock',13)} ${esc(time)}</span></div>
    ${student?`<div class="result-person"><div class="candidate-avatar">${esc(initials(student.fullName))}</div><div><h2>${esc(student.fullName)}</h2><div class="mono muted">${esc(student.rollNumber||'Roll number unavailable')}</div><p>${esc(student.currentClass||'')}</p></div><div class="result-icon">${ic(symbol,23)}</div></div>`:`<div class="result-person"><div class="result-icon">${ic(symbol,23)}</div><p>${esc(message)}</p></div>`}
    ${student?`<p class="result-description">${ic('shield',15)} ${esc(message)}</p>`:''}
    <div class="result-actions">${button('resume-scanner',isNativeApp()?'Scan next QR':'Resume scanning','btn btn-light',false,'scan')}${button('nav-roster','Review roster','btn btn-outline',false,'users')}</div>
  </article>`;
}
function renderRoster() {
  if (!state.selected) return `<section class="page">${sectionHeader('SELECT AN EXAM','Attendance roster','Choose a Hall to review its registered candidates.')}${button('nav-exams','Choose a hall','btn btn-dark',false,'arrow')}</section>`;
  const m = computeSessionMetrics({stats:state.stats});
  let filtered = state.roster;
  if (state.filter==='present') filtered=filtered.filter(c=>['PRESENT','LATE'].includes(c.status));
  if (state.filter==='unmarked') filtered=filtered.filter(c=>c.status==='NOT_MARKED');
  if (state.filter==='absent') filtered=filtered.filter(c=>c.status==='ABSENT');
  return `<section class="page roster-page">${renderSessionHeading()}
    <div class="roster-head"><div><span class="eyebrow">VERIFIED ROSTER · BACKEND SNAPSHOT</span><h2>Attendance register</h2><p>Immutable Hall membership · Recorded against the current attempt.</p></div><button class="small-outline" data-action="refresh-roster">${ic('refresh',17)} Refresh</button></div>
    <div class="roster-summary"><div class="summary-box"><span>ENROLLED</span><strong>${count(m.expected)}</strong><small>Roster</small></div><div class="summary-box good"><span>PRESENT</span><strong>${count(m.present)}</strong><small>${percent(m.expected?m.present/m.expected*100:0)}</small></div><div class="summary-box amber"><span>UNMARKED</span><strong>${count(m.remaining)}</strong><small>Pending</small></div><div class="summary-box red"><span>ABSENT</span><strong>${count(m.absent)}</strong><small>Marked</small></div></div>
    <div class="roster-progress">${metricBar(m.percent)}<span>${count(m.marked)} of ${count(m.expected)} recorded · ${percent(m.percent)}</span></div>
    <div class="roster-toolbar"><div class="search-field">${ic('search',19)}<input id="roster-search" placeholder="Search name, roll or seat…" autocomplete="off" maxlength="200" value="${esc(state.search)}" aria-label="Search roster"/><button class="input-clear" data-action="clear-search" ${state.search?'':'hidden'} title="Clear search">${ic('x',15)}</button></div></div>
    <div class="filter-bar">${[['all','All'],['present','Present'],['unmarked','Unmarked'],['absent','Absent']].map(([key,label])=>`<button class="filter-pill ${state.filter===key?'selected':''}" data-action="filter-roster" data-filter="${key}">${label}</button>`).join('')}</div>
    <div class="roster-hint">Showing ${count(filtered.length)} on page ${state.rosterPage} of ${state.rosterPages}. Status filter applies to the loaded page; text search runs on the server.</div>
    <div class="candidate-list">${filtered.length?filtered.map(candidateCard).join(''):`<div class="empty-card compact">${ic('search',25)}<h3>No matching candidates on this page</h3><p>Change the filter or search term.</p></div>`}</div>
    <div class="pagination"><button class="btn btn-outline btn-small" data-action="roster-prev" ${state.rosterPage<=1?'disabled':''}>${ic('back',15)} Previous</button><span>Page ${state.rosterPage} / ${state.rosterPages}</span><button class="btn btn-outline btn-small" data-action="roster-next" ${state.rosterPage>=state.rosterPages?'disabled':''}>Next ${ic('chevron',15)}</button></div>
    <div class="roster-bottom"><button class="btn btn-light" data-action="export-roster">${ic('download',18)} Export visible CSV</button>${isAdmin()&&activeSession()?button('open-close','Close Hall session','btn btn-dark',false,'lock'):''}</div>
    <div class="scan-note">${ic('info',16)} Only administrators may close Hall sessions. Teacher accounts can scan or manually verify candidates during an OPEN attempt.</div>
  </section>`;
}
function candidateCard(c) {
  const marked=c.status!=='NOT_MARKED', allowed=activeSession()&&c.status==='NOT_MARKED';
  return `<article class="candidate-card"><div class="candidate-primary"><div class="candidate-avatar">${esc(initials(c.fullNameSnapshot))}</div><div class="candidate-info"><h3>${esc(c.fullNameSnapshot)}</h3><p class="mono">${esc(c.rollNumberSnapshot || c.applicationNoSnapshot || 'No roll number')}</p><p>${esc(c.currentClassSnapshot||'Candidate')} <span class="info-divider">•</span> Seat <b>${esc(c.seatNoSnapshot||'Unassigned')}</b></p></div><div class="candidate-right">${chip(c.status)}<small>${c.markedAt?esc(niceTime(c.markedAt)):'Not recorded'}</small></div></div>
    ${allowed?`<div class="candidate-footer"><span>${ic('info',14)} Verify the physical candidate before manual marking.</span><button class="btn btn-dark btn-xs" data-action="manual-mark" data-id="${esc(c.studentId)}">${ic('check',16)} Manual verify</button></div>`:
    `<div class="candidate-footer"><span>${ic(marked?'shield':'lock',15)} ${marked?`${esc(c.method==='QR_SCAN'?'QR scan':'Manual entry')} · server recorded`:'This attempt is read only'}</span></div>`}
  </article>`;
}
function renderAccount() {
  const user=state.user;
  return `<section class="page account-page">${sectionHeader('SECURE OPERATOR','Your workspace','Authenticated access to AZM.AIO examination attendance.')}
    <div class="account-card"><div class="profile-round">${esc(initials(user?.name))}</div><h2>${esc(user?.name)}</h2><p>${esc(user?.email)}</p><span class="role-chip">${ic('shield',15)} ${esc(user?.role?.replaceAll('_',' ')||'STAFF')}</span></div>
    <div class="account-section"><h3>Connection &amp; integrity</h3><div class="account-row"><span>${ic('wifi',18)} Network</span><strong>${state.online?'Device online':'Device offline'}</strong></div><div class="account-row"><span>${ic('shield',18)} API origin</span><code>${esc(api.state.base)}</code></div><div class="account-row"><span>${ic('lock',18)} Login tokens</span><strong>Memory-only</strong></div><div class="account-row"><span>${ic('scan',18)} QR verification</span><strong>Backend-enforced</strong></div></div>
    <div class="account-section"><h3>Session rules</h3><p>Authorized staff may view active Hall sessions. Teachers can scan signed QRs and manually mark roster candidates. Only administrators may prepare, open and close sessions. Student attendance is never confirmed without an API response.</p></div>
    ${button('check-server','Check server connection','btn btn-outline wide',false,'refresh')}
    ${button('logout','Sign out of this device','btn btn-danger wide',false,'logout')}
    <p class="center-muted">Signing out clears tokens held by this app. The existing AZM.AIO backend logout endpoint does not invalidate issued tokens server-side.</p>
  </section>`;
}
function renderModal() {
  const root=document.querySelector('#modal-root');
  if (!root) return;
  const modal=state.modal;
  if (!modal) { root.innerHTML=''; return; }
  let body='';
  if (modal.type==='manual') {
    const c=modal.candidate;
    body=`<div class="modal-icon blue">${ic('users',26)}</div><h2>Confirm manual verification</h2><p class="modal-lede">Check the candidate's identity and roll slip before recording attendance.</p>
      <div class="confirm-candidate"><b>${esc(c.fullNameSnapshot)}</b><span>${esc(c.rollNumberSnapshot||c.applicationNoSnapshot||'No roll number')} · Seat ${esc(c.seatNoSnapshot||'Unassigned')}</span></div>
      <div class="modal-warning">${ic('shield',17)} This will record PRESENT using your authenticated staff identity. It cannot be marked as a QR scan.</div>
      ${state.modalError?`<p role="alert" class="inline-error">${esc(state.modalError)}</p>`:''}
      <div class="modal-buttons">${button('close-modal','Cancel','btn btn-outline',state.busy)}${button('confirm-manual',state.busy?'Submitting…':'Confirm present','btn btn-dark',state.busy,'check')}</div>`;
  } else if (modal.type==='close') {
    const m=computeSessionMetrics({stats:state.stats});
    body=`<div class="modal-icon red">${ic('lock',26)}</div><h2>Close examination session</h2><p class="modal-lede">Closing the current OPEN attempt prevents additional QR and manual attendance marks.</p>
      <div class="modal-warning">${ic('alert',18)} ${count(m.remaining)} candidates are currently unmarked. This action changes the Hall status in the backend.</div>
      <label class="checkbox-row"><input id="close-absent" type="checkbox"/><span>Mark every remaining candidate ABSENT on closing (irreversible audit action)</span></label>
      <label class="form-label" for="confirm-close-text">TYPE <b>CLOSE SESSION</b> TO CONFIRM</label><input id="confirm-close-text" class="form-input" placeholder="CLOSE SESSION" autocomplete="off"/>
      ${state.modalError?`<p role="alert" class="inline-error">${esc(state.modalError)}</p>`:''}
      <div class="modal-buttons">${button('close-modal','Cancel','btn btn-outline',state.busy)}${button('confirm-close',state.busy?'Closing…':'Close Hall','btn btn-danger',state.busy,'lock')}</div>`;
  }
  root.innerHTML=`<div class="modal-mask" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="Attendance confirmation" tabindex="-1" data-modal-box="true">${body}</section></div>`;
  root.querySelector('.modal')?.focus();
}
function render() {
  if (!state.user) { stopCamera(); renderLogin(); return; }
  const appHasShell = Boolean(app.querySelector('.shell'));
  if (!appHasShell) app.innerHTML=renderChrome();
  const content=document.querySelector('#content');
  if (state.view==='exams') content.innerHTML=renderExams();
  else if (state.view==='scanner') content.innerHTML=renderScanner();
  else if (state.view==='roster') content.innerHTML=renderRoster();
  else content.innerHTML=renderAccount();
  document.querySelector('.bottomnav')?.replaceWith((()=>{const template=document.createElement('template');template.innerHTML=`<nav class="bottomnav" aria-label="Primary navigation">${navItem('exams','Exams','calendar')}${navItem('scanner','Scan QR','scan')}${navItem('roster','Roster','list')}${navItem('account','Account','users')}</nav>`;return template.content.firstElementChild;})());
  renderModal();
}
function stopCamera() { nativeScanRun++; nativeScanBusy = false; clearTimeout(continueTimer); continueTimer=null; if (camera) { camera.stop(); camera=null; } state.cameraState='idle'; state.torch=false; }
async function go(view) {
  if (state.view===view) return;
  if (state.view==='scanner') stopCamera();
  state.view=view; state.error=''; state.modal=null;
  render(); window.scrollTo({top:0,behavior:'instant'});
  if (view==='exams' && state.sessions.length===0) await loadSessions(1);
  if (view==='roster' && state.selected) await loadRoster(1);
}
async function loadSessions(page=1) {
  if (!state.user) return;
  const generation=++activityGeneration;
  try {
    const data=await api.sessions({page,limit:100});
    if (generation!==activityGeneration || !state.user) return;
    const rows=Array.isArray(data?.sessions)?data.sessions:[];
    state.sessions=page===1?rows:state.sessions.concat(rows.filter(s=>!state.sessions.some(x=>x.id===s.id)));
    state.sessionPage=page;
    state.sessionHasMore=page<Number(data?.pagination?.totalPages||1);
    if (state.view==='exams') render();
  } catch(err) { handleError(err); }
}
async function chooseSession(id) {
  if (!id || state.busy) return;
  state.busy=true;
  notify('Checking the exact examination attempt…');
  try {
    const data=await api.session(id);
    if (!data?.session || data.session.id!==id) throw new ApiError('Unexpected Hall response. Selection was not accepted.');
    state.selected=data.session;
    state.stats=data.stats;
    state.roster=[];
    state.rosterPage=1;state.search='';state.filter='all';state.scannerResult=null;
    state.view=activeSession()?'scanner':'roster';
    render();
    if (activeSession()) {
      notify(isNativeApp()?'Hall verified. Google scanner will verify signed QR codes with AZM.AIO.':'Hall verified. Start the camera to scan signed QR codes.','success');
      if (isNativeApp()) warmNativeGoogleScanner();
    }
    else await loadRoster(1);
  } catch(err) { handleError(err); }
  finally { state.busy=false; }
}
async function refreshSessionSummary() {
  const sel=state.selected;
  if (!sel) return;
  const data=await api.sessionSummary(sel.examHallId);
  const exact=data?.sessions?.find(s=>s.id===sel.id);
  if (!exact) {
    stopCamera(); state.selected=null; state.stats=null; render();
    throw new ApiError('This Hall is no longer in the current session list. Refresh and reselect it.',409,'SESSION_CHANGED');
  }
  if (exact.revision!==sel.revision || exact.status!==sel.status || !exact.isCurrent) {
    state.selected=exact; state.stats=exact.stats;
    stopCamera(); render();
    throw new ApiError('The Hall attempt or revision changed. Scanning stopped; review the Hall again.',409,'SESSION_CHANGED');
  }
  state.selected=exact; state.stats=exact.stats;
  updateScanCounters();
}
function updateScanCounters() {
  const m=computeSessionMetrics({stats:state.stats});
  const label=document.querySelector('#scan-progress-label'); if(label)label.textContent=`${count(m.present)} present · ${count(m.remaining)} unmarked`;
  const pct=document.querySelector('#scan-percentage');if(pct)pct.textContent=percent(m.percent);
  const bar=document.querySelector('#scan-bar');if(bar)bar.innerHTML=metricBar(m.percent);
  const line=document.querySelector('.scanner-summary');if(line)line.innerHTML=`<div>${count(m.present)} <span>present</span></div><div>${count(m.remaining)} <span>remaining</span></div><strong>${percent(m.percent)}</strong>`;
}
async function loadRoster(page=1) {
  if(!state.selected) return;
  const target=state.selected.id, gen=++activityGeneration;
  try {
    const data=await api.candidates(target,{page,limit:40,search:state.search});
    if(gen!==activityGeneration || state.selected?.id!==target) return;
    state.roster=Array.isArray(data?.candidates)?data.candidates:[];
    state.rosterPage=page;
    state.rosterPages=Math.max(1,Number(data?.pagination?.totalPages||1));
    state.rosterTotal=Number(data?.pagination?.total||0);
    if(state.view==='roster') {
      const input=document.activeElement?.id==='roster-search'?document.activeElement:null;
      const cursor=input?.selectionStart;
      render();
      if(input){const restored=document.querySelector('#roster-search');restored?.focus({preventScroll:true});
        if(Number.isInteger(cursor))restored?.setSelectionRange(cursor,cursor);}
    }
  } catch(err){handleError(err);}
}
async function refreshRoster() {
  const target=state.selected?.id;
  if(!target)return;
  try {const detail=await api.session(target); state.selected=detail.session;state.stats=detail.stats;await loadRoster(state.rosterPage);}catch(err){handleError(err);}
}
async function warmNativeGoogleScanner() {
  if (!isNativeApp() || !state.online) return;
  try {
    const bridge = await import('./native-bridge.js');
    const result = await bridge.prepareGoogleScanner();
    if (state.view === 'scanner') scannerStatus(result.ready?'GOOGLE SCANNER READY':'INSTALLING GOOGLE SCANNER');
    if (result.downloading) notify('Google Play Services is preparing the fast QR scanner. Scanning becomes available after its download.');
  } catch (err) { notify(safeMessage(err), 'error'); }
}
function scannerStatus(label) { const node=document.querySelector('#camera-label'); if(node)node.textContent=label; }
async function toggleCamera() {
  if (isNativeApp()) return scanNativeGoogle();
  if (!activeSession()) return notify('Only the current OPEN attempt can be scanned.','error');
  if (!state.online) return notify('Device is offline. Connect before scanning.','error');
  if (camera?.active) { stopCamera();scannerStatus('OPTICAL STANDBY');const btn=document.querySelector('[data-action="toggle-camera"]');if(btn)btn.innerHTML=`${ic('camera',18)} Start camera`;notify('Camera stopped.');return; }
  const video=document.querySelector('#camera-video');if(!video)return;
  camera=new LiveQrCamera({onCode:handleDecodedQr,onError:err=>notify(safeMessage(err),'error'),onState:s=>{state.cameraState=s;scannerStatus(s==='ready'?'LIVE QR DETECTOR':s==='paused'?'VERIFYING / PAUSED':'OPTICAL STANDBY');}});
  const buttonEl=document.querySelector('[data-action="toggle-camera"]');
  if(buttonEl) {buttonEl.disabled=true;buttonEl.textContent='Starting camera…';}
  try {
    await camera.start(video);
    if(buttonEl){buttonEl.disabled=false;buttonEl.innerHTML=`${ic('x',18)} Stop camera`;}
    notify('Camera is ready. Point it at a signed AZM roll-slip QR.','success');
  } catch(err) {
    stopCamera(); if(buttonEl){buttonEl.disabled=false;buttonEl.innerHTML=`${ic('camera',18)} Start camera`;}
    notify(safeMessage(err),'error');
  }
}
async function scanNativeGoogle() {
  if (!activeSession()) return notify('Choose a current OPEN Hall before scanning.', 'error');
  if (!state.online) return notify('Device is offline. No attendance can be recorded.', 'error');
  if (nativeScanBusy || state.scanBusy) return;
  nativeScanBusy = true;
  const run = ++nativeScanRun;
  const btn = document.querySelector('[data-action="toggle-camera"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening Google scanner…'; }
  try {
    scannerStatus('GOOGLE CODE SCANNER');
    const bridge = await import('./native-bridge.js');
    const code = await bridge.scanWithGoogle();
    if (run !== nativeScanRun || state.view !== 'scanner') return;
    if (code) await handleDecodedQr(code);
    else notify('Scan was cancelled. No attendance was recorded.');
    if (state.autoAdvance && code && ['success','duplicate'].includes(state.scannerResult?.type) && activeSession()) {
      clearTimeout(continueTimer);
      continueTimer = setTimeout(() => { if (run === nativeScanRun && state.view === 'scanner' && !nativeScanBusy && !state.scanBusy && activeSession() && state.online) scanNativeGoogle(); }, 1500);
    }
  } catch (err) {
    if (run === nativeScanRun) notify(safeMessage(err), 'error');
  } finally {
    nativeScanBusy = false;
    const fresh = document.querySelector('[data-action="toggle-camera"]');
    if (fresh) { fresh.disabled = !activeSession(); fresh.innerHTML = `${ic('camera',18)} Open Google camera`; }
    scannerStatus('GOOGLE SCANNER READY');
  }
}
function feedback(type, student, message) {
  clearToast(); // Do not obscure the candidate identity/confirmation with an old toast.
  state.scannerResult={type,student:student||null,message,time:niceTime(new Date())};
  const target=document.querySelector('#scan-feedback');if(target)target.innerHTML=renderScanFeedback();
  announce(message+(student?.fullName?` for ${student.fullName}`:''));
  if(type==='success') {
    if(state.haptic)navigator.vibrate?.(65);
    if(state.sound)beep(true);
  } else if(type==='duplicate') {if(state.haptic)navigator.vibrate?.([35,50,35]);if(state.sound)beep(false);}
  else if(state.haptic)navigator.vibrate?.(130);
}
function beep(success) {
  try { const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;const ctx=new Audio();const tone=ctx.createOscillator(),gain=ctx.createGain();tone.type='sine';tone.frequency.value=success?880:390;gain.gain.value=0.045;tone.connect(gain);gain.connect(ctx.destination);tone.start();tone.stop(ctx.currentTime+0.115);tone.onended=()=>ctx.close(); }catch{}
}
async function handleDecodedQr(raw) {
  if(state.scanBusy || !activeSession())return;
  camera?.pause();
  state.scanBusy=true;
  const lockedSession={...state.selected};
  try {
    const signedToken = extractAttendanceQrToken(raw);
    if(!signedToken)throw new ApiError('QR recognized, but it is not an issued AZM.AIO attendance QR. Nothing was marked.',400,'INVALID_QR_SHAPE');
    scannerStatus('SERVER VERIFICATION');
    // A real roll-slip QR is https://azmaio.com/attend?token=qr_...; only the opaque token is sent.
    // Important: no optimistic PRESENT update here. Server must accept the HMAC and roster identity.
    const result=await api.scan(lockedSession,signedToken);
    if(!result?.attendance || !result?.student?.id) throw new ApiError('Server did not confirm a valid attendance record.',502,'MISSING_CONFIRMATION');
    const duplicate=result.alreadyMarked===true;
    if(!duplicate && (result.attendance.status!=='PRESENT' || result.attendance.method!=='QR_SCAN'))
      throw new ApiError('Server returned an unexpected QR attendance status. Recheck the roster.',502,'MISSING_CONFIRMATION');
    const existingStatus=String(result.attendance.status||'MARKED');
    const message=duplicate?`Already recorded as ${existingStatus} in this Hall. No duplicate record was created.`:'Attendance confirmed and saved by AZM.AIO.';
    feedback(duplicate?'duplicate':'success',result.student,message);
    state.recent.unshift({student:result.student,type:duplicate?'duplicate':'success',time:Date.now()});state.recent=state.recent.slice(0,10);
    try {await refreshSessionSummary();}catch(refreshError){notify(safeMessage(refreshError),'error');state.autoAdvance=false;}
    if(activeSession() && state.autoAdvance && camera?.active) {
      clearTimeout(continueTimer);
      continueTimer=setTimeout(()=>{if(!state.scanBusy && activeSession())camera?.resume();},1900);
    }
  } catch(err) {
    const message=err?.isNetwork?'Attendance NOT confirmed. Recheck the roster before scanning again.':safeMessage(err);
    feedback('error',null,message);
    if(err?.status===409 || err?.status===401 || err?.isNetwork){state.autoAdvance=false;}
    if(err?.status===409){try{await refreshSessionSummary();}catch{} }
    if(err?.status===401 && !api.state.signedIn) { await signOut();return; }
    if(err?.code==='INVALID_QR_SHAPE' && state.autoAdvance && camera?.active) {
      continueTimer=setTimeout(()=>camera?.resume(),1800);
    }
  } finally {
    state.scanBusy=false;
    scannerStatus(camera?.paused?'SCAN PAUSED':camera?.active?'LIVE QR DETECTOR':'OPTICAL STANDBY');
    const auto=document.querySelector('#auto-advance');if(auto)auto.checked=state.autoAdvance;
  }
}
async function manualMark(id) {
  if(!activeSession())return notify('Hall is no longer open.','error');
  const candidate=state.roster.find(c=>c.studentId===id);
  if(!candidate || candidate.status!=='NOT_MARKED')return notify('Candidate is already marked or no longer on this page. Refresh the roster.','error');
  state.modal={type:'manual',candidate};state.modalError='';renderModal();
}
async function confirmManual() {
  const candidate=state.modal?.candidate;
  if(!candidate||state.busy||!activeSession())return;
  state.busy=true;renderModal();
  try {
    const result=await api.manualPresent(state.selected,candidate.studentId);
    if(!result?.attendance || !result?.student?.id || result.attendance.status!=='PRESENT' || result.attendance.method!=='MANUAL')
      throw new ApiError('No valid server confirmation received for manual PRESENT attendance.');
    state.modal=null;renderModal();
    notify(`${result.student.fullName} marked PRESENT by manual verification.`, 'success');
    try{await refreshSessionSummary();}catch(err){notify(safeMessage(err),'error');}
    await loadRoster(state.rosterPage);
  }catch(err){state.modalError=safeMessage(err);renderModal();}
  finally{state.busy=false;renderModal();}
}
async function confirmClose() {
  if(state.busy||!state.selected)return;
  const phrase=document.querySelector('#confirm-close-text')?.value;
  const absent=Boolean(document.querySelector('#close-absent')?.checked);
  if(phrase!=='CLOSE SESSION'){state.modalError='Type CLOSE SESSION exactly to confirm.';renderModal();return;}
  state.busy=true;renderModal();
  try {
    const result=await api.closeSession(state.selected,absent);
    if(!result?.session || result.session.status!=='CLOSED') throw new ApiError('Close request was not confirmed by the server.');
    state.selected=result.session;state.stats=result.stats;state.modal=null;
    await loadSessions(1);await loadRoster(1);
    notify('The Hall session is now CLOSED. No more attendance can be recorded.','success');
  }catch(err){state.modalError=safeMessage(err);}
  finally{state.busy=false;render();}
}
function exportVisibleCsv() {
  if(!state.roster.length)return notify('There are no visible roster rows to export.','error');
  const filtered=state.roster.filter(c=>state.filter==='all'||(state.filter==='present'?['PRESENT','LATE'].includes(c.status):state.filter==='unmarked'?c.status==='NOT_MARKED':c.status==='ABSENT'));
  const columns=[['Student', 'fullNameSnapshot'],['Roll', 'rollNumberSnapshot'],['Application','applicationNoSnapshot'],['Seat','seatNoSnapshot'],['Status','status'],['Method','method'],['Recorded at','markedAt']];
  const safeCsv=v=>'"'+String(v??'').replace(/^([=+\-@\t\r])/,'\'$1').replaceAll('"','""')+'"';
  const content='\ufeff'+[columns.map(x=>x[0]),...filtered.map(c=>columns.map(x=>c[x[1]]))].map(row=>row.map(safeCsv).join(',')).join('\r\n');
  const blob=new Blob([content],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='azm-hall-roster-visible.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Exported current page only. This is not an official signed report.','success');
}
function handleError(err) {if(err?.status===401&&!api.state.signedIn){signOut();return;}notify(safeMessage(err),'error');}
async function signOut() {
  stopCamera();await api.logout();activityGeneration++;state.user=null;state.sessions=[];state.selected=null;state.stats=null;state.roster=[];state.modal=null;state.view='login';state.error='';render();
}

app.addEventListener('submit', async event => {
  if(event.target?.id!=='login-form')return;
  event.preventDefault();if(state.busy)return;
  const data=new FormData(event.target);const email=String(data.get('email')||'').trim();const password=String(data.get('password')||'');
  state.busy=true;state.error='';const submit=event.target.querySelector('[type=submit]');if(submit){submit.disabled=true;submit.textContent='Authenticating…';}
  try {
    const user=await api.login(email,password);
    state.user=user;state.view='exams';render();await loadSessions(1);
    notify(`Signed in as ${user.name}. Check the Hall before scanning.`, 'success');
  }catch(err){state.error=safeMessage(err);render();}
  finally{state.busy=false;const btn=document.querySelector('#login-form [type=submit]');if(btn){btn.disabled=false;btn.innerHTML=`${ic('lock',18)} Access Attendance Workspace ${ic('arrow',18)}`;}}
});

app.addEventListener('click', async event => {
  const control=event.target.closest('[data-action]');if(!control)return;
  const action=control.dataset.action;
  if(state.busy && !['close-modal','dismiss-toast'].includes(action))return;
  switch(action){
    case 'toggle-password': {const input=document.querySelector('#staff-pass');if(!input)return;input.type=input.type==='password'?'text':'password';control.innerHTML=ic(input.type==='text'?'eyeoff':'eye',19);control.setAttribute('aria-label',input.type==='text'?'Hide password':'Show password');break;}
    case 'nav-exams':await go('exams');break;
    case 'nav-scanner':await go('scanner');break;
    case 'nav-roster':await go('roster');break;
    case 'nav-account':case 'account':await go('account');break;
    case 'refresh-exams':await loadSessions(1);notify('Session list refreshed.');break;
    case 'more-exams':await loadSessions(state.sessionPage+1);break;
    case 'select-session':await chooseSession(control.dataset.id);break;
    case 'toggle-camera':await toggleCamera();break;
    case 'resume-scanner':if(!activeSession())return notify('Hall is not open.','error');if(!camera?.active){await toggleCamera();}else{camera.resume();scannerStatus('LIVE QR DETECTOR');}break;
    case 'toggle-sound':state.sound=!state.sound;control.innerHTML=ic(state.sound?'volume':'mute',18);control.classList.toggle('enabled',state.sound);break;
    case 'toggle-haptic':state.haptic=!state.haptic;control.classList.toggle('enabled',state.haptic);break;
    case 'torch':try{state.torch=await camera?.setTorch(!state.torch)||false;control.classList.toggle('enabled',state.torch);}catch(err){notify(safeMessage(err),'error');}break;
    case 'refresh-roster':await refreshRoster();break;
    case 'clear-search':state.search='';state.filter='all';await loadRoster(1);break;
    case 'filter-roster':state.filter=control.dataset.filter;render();break;
    case 'roster-prev':if(state.rosterPage>1)await loadRoster(state.rosterPage-1);break;
    case 'roster-next':if(state.rosterPage<state.rosterPages)await loadRoster(state.rosterPage+1);break;
    case 'manual-mark':await manualMark(control.dataset.id);break;
    case 'open-close':if(isAdmin()&&activeSession()){state.modal={type:'close'};state.modalError='';renderModal();}break;
    case 'confirm-manual':await confirmManual();break;
    case 'confirm-close':await confirmClose();break;
    case 'export-roster':exportVisibleCsv();break;
    case 'close-modal':if(event.target.closest('[data-modal-box]') && control.classList.contains('modal-mask'))return;state.modal=null;state.modalError='';renderModal();break;
    case 'dismiss-toast':clearToast();break;
    case 'check-server':try{const result=await api.health();notify(result?.database?.status==='connected'?'Backend and database are responding.':'Backend responded, but database health is degraded.',result?.database?.status==='connected'?'success':'error');}catch(err){handleError(err);}break;
    case 'logout':await signOut();break;
  }
});
app.addEventListener('change',async event=>{
  const target=event.target;
  if(target?.id==='auto-advance'){state.autoAdvance=target.checked;if(state.autoAdvance&&camera?.active&&camera.paused&&!state.scanBusy)camera.resume();}
  if(target?.id==='qr-photo'&&target.files?.[0]){
    if(!activeSession()){notify('The Hall must be OPEN.','error');return;}
    const file=target.files[0];
    try{camera?.pause();const code=await decodeQrPhoto(file);await handleDecodedQr(code);}catch(err){feedback('error',null,safeMessage(err));}finally{target.value='';}
  }
});
app.addEventListener('input',event=>{
  if(event.target?.id!=='roster-search')return;
  state.search=event.target.value;clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{if(state.view==='roster')loadRoster(1);},380);
});
window.addEventListener('online',()=>{state.online=true;const el=document.querySelector('#net-pill');if(el){el.className='net-pill net-on';el.innerHTML='<i></i>DEVICE ONLINE';}});
window.addEventListener('offline',()=>{state.online=false;const el=document.querySelector('#net-pill');if(el){el.className='net-pill net-off';el.innerHTML='<i></i>DEVICE OFFLINE';}if(state.view==='scanner'){camera?.pause();notify('Network lost. QR scanning paused; no offline marks will be queued.','error');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&camera?.active){camera.pause();scannerStatus('PAUSED / APP IN BACKGROUND');}});
window.addEventListener('pagehide',()=>stopCamera());
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.modal){state.modal=null;state.modalError='';renderModal();}});
render();

// Do not cache APIs or authentication data. Only the installable UI assets are cached.
if(!isNativeApp() && 'serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
