/**
 * AZM.AIO attendance API client, checked against backend/src/modules/{auth,attendance}.
 * Tokens are deliberately memory-only: a cold start requires staff login again.
 * Production attendance writes never get replayed after transport/timeouts.
 */
export class ApiError extends Error {
  constructor(message, status = 0, code = '', isNetwork = false) {
    super(message);
    this.name = 'ApiError'; this.status = status; this.code = code; this.isNetwork = isNetwork;
  }
}

export const STAFF_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEACHER']);
export const SESSION_STATES = new Set(['PRE_OPEN', 'OPEN', 'CLOSED', 'CANCELLED']);
const TOKEN_RE = /^qr_[A-Za-z0-9_-]+\.[A-Fa-f0-9]{64}$/;

export function isSignedQrShape(value) {
  return typeof value === 'string' && value.length < 2048 && TOKEN_RE.test(value.trim());
}

/**
 * Issued AZM.AIO roll-slip QR codes contain an HTTPS attendance URL,
 * NOT the bare qr_ token. Only extract an opaque token from the exact
 * official attendance link. Server-side HMAC verification is still mandatory.
 */
export function extractAttendanceQrToken(decoded) {
  if (typeof decoded !== 'string' || decoded.length > 4096) return null;
  const value = decoded.trim();
  if (isSignedQrShape(value)) return value;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || !['azmaio.com','www.azmaio.com'].includes(url.hostname) ||
      url.username || url.password || url.port || url.pathname !== '/attend' || url.hash ||
      [...url.searchParams.keys()].length !== 1 || !url.searchParams.has('token')) return null;
  const token = url.searchParams.get('token');
  return isSignedQrShape(token) ? token.trim() : null;
}

export function sanitizeOrigin(input, pageOrigin = (typeof location !== 'undefined' ? location.origin : 'http://localhost:8080')) {
  const raw = String(input || '').trim().replace(/\/+$/, '');
  const chosen = raw || pageOrigin;
  let url;
  try { url = new URL(chosen); } catch { throw new ApiError('The configured AZM API address is invalid.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new ApiError('The AZM API must use HTTPS (localhost development is the only exception).');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new ApiError('Set the AZM API origin only, without /api or any path.');
  }
  return url.origin;
}

export function computeSessionMetrics(data) {
  const s = data?.stats || {};
  return {
    expected: Math.max(0, Number(s.expectedCount) || 0),
    marked: Math.max(0, Number(s.markedCount) || 0),
    present: Math.max(0, Number(s.presentCount) || 0),
    absent: Math.max(0, Number(s.absentCount) || 0),
    remaining: Math.max(0, Number(s.unmarkedCount) || 0),
    percent: Math.min(100, Math.max(0, Number(s.completionPercentage) || 0)),
    qr: Math.max(0, Number(s.qrCount) || 0),
    manual: Math.max(0, Number(s.manualCount) || 0),
  };
}

export function createAttendanceApi({ fetchImpl = globalThis.fetch?.bind(globalThis), origin = '', pageOrigin } = {}) {
  if (!fetchImpl) throw new Error('fetch is required');
  const base = sanitizeOrigin(origin, pageOrigin);
  let accessToken = null;
  let refreshToken = null;
  let currentUser = null;
  let inflightRefresh = null;
  const listeners = new Set();
  const tell = () => listeners.forEach(fn => fn(currentUser));
  const state = () => ({ signedIn: Boolean(accessToken && currentUser), user: currentUser, base });
  const forget = () => { accessToken = null; refreshToken = null; currentUser = null; tell(); };

  async function transport(path, { method = 'GET', body, bearer, signal, timeoutMs = 14000, rawResponse = false } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort, { once: true });
    let response;
    try {
      response = await fetchImpl(base + '/api' + path, {
        method, headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store', credentials: 'omit', signal: controller.signal,
      });
    } catch (error) {
      throw new ApiError(error?.name === 'AbortError' ? 'Server request timed out. Attendance was NOT confirmed. Refresh the roster before retrying.' : 'Cannot reach the AZM server. Attendance was NOT confirmed.', 0, 'NETWORK', true);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', forwardAbort);
    }
    let payload;
    try { payload = await response.json(); } catch {
      throw new ApiError('AZM returned an invalid response. Attendance was NOT confirmed.', response.status, 'INVALID_RESPONSE');
    }
    if (!response.ok || !payload || (!rawResponse && payload.success !== true)) {
      const message = payload?.error?.message || payload?.message || `Request failed (HTTP ${response.status}).`;
      throw new ApiError(message, response.status, payload?.error?.code || 'API_ERROR');
    }
    return rawResponse ? payload : payload.data;
  }

  async function refresh() {
    if (!refreshToken) return false;
    if (inflightRefresh) return inflightRefresh;
    inflightRefresh = (async () => {
      try {
        const result = await transport('/auth/refresh', { method: 'POST', body: { refreshToken }, timeoutMs: 10000 });
        if (!result?.accessToken || !result?.refreshToken) throw new ApiError('Invalid refresh response.');
        accessToken = result.accessToken;
        refreshToken = result.refreshToken;
        return true;
      } catch { forget(); return false; }
      finally { inflightRefresh = null; }
    })();
    return inflightRefresh;
  }

  async function authorized(path, options = {}) {
    if (!accessToken) throw new ApiError('Please sign in before accessing attendance.', 401, 'AUTH_REQUIRED');
    try { return await transport(path, { ...options, bearer: accessToken }); }
    catch (error) {
      if (error.status !== 401) throw error;
      const ok = await refresh();
      if (!ok) throw new ApiError('Your session expired. Sign in again.', 401, 'SESSION_EXPIRED');
      // Explicit 401 retry only, never a blind retry of an uncertain network write.
      return transport(path, { ...options, bearer: accessToken });
    }
  }

  function guardOpen(session) {
    if (!session || !session.id || session.status !== 'OPEN' || !session.isCurrent || !Number.isInteger(session.revision) || session.revision < 1) {
      throw new ApiError('Only the current OPEN Hall session can accept attendance. Refresh the session.', 409, 'SESSION_NOT_OPEN');
    }
  }

  return {
    get state() { return state(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async login(email, password) {
      const input = { email: String(email).trim().toLowerCase(), password: String(password) };
      if (!input.email || !input.password) throw new ApiError('Enter your staff email address and password.');
      const result = await transport('/auth/login', { method: 'POST', body: input });
      if (!result?.accessToken || !result?.refreshToken || !result?.user || !STAFF_ROLES.has(result.user.role) || result.user.status !== 'ACTIVE') {
        forget(); throw new ApiError('This account is not authorized for the attendance app.', 403, 'ROLE_FORBIDDEN');
      }
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
      currentUser = result.user;
      try {
        const me = await authorized('/auth/me');
        if (!me?.user || me.user.id !== currentUser.id || !STAFF_ROLES.has(me.user.role) || me.user.status !== 'ACTIVE') {
          throw new ApiError('Staff authorization could not be confirmed.', 403, 'ROLE_FORBIDDEN');
        }
        currentUser = me.user;
      } catch (err) { forget(); throw err; }
      tell();
      return currentUser;
    },
    async logout() {
      // Server /logout currently returns an acknowledgement, not token revocation.
      forget();
    },
    async me() {
      const me = await authorized('/auth/me');
      if (!me?.user || !STAFF_ROLES.has(me.user.role) || me.user.status !== 'ACTIVE') { forget(); throw new ApiError('Not an active attendance operator.', 403); }
      currentUser = me.user; tell(); return currentUser;
    },
    async health() { return transport('/health', { rawResponse: true, timeoutMs: 10000 }); },
    async sessions({ page = 1, limit = 100, status, includeHistory = false } = {}) {
      const q = new URLSearchParams({ page: String(page), limit: String(Math.min(100, Math.max(1, limit))) });
      if (status) q.set('status', status);
      if (includeHistory) q.set('includeHistory', 'true');
      return authorized('/attendance/sessions?' + q);
    },
    async session(id) { return authorized('/attendance/sessions/' + encodeURIComponent(id)); },
    async sessionSummary(hallId) {
      const q = new URLSearchParams({ examHallId: String(hallId), page: '1', limit: '100' });
      return authorized('/attendance/sessions?' + q);
    },
    async candidates(id, { page = 1, limit = 40, search = '' } = {}) {
      const q = new URLSearchParams({ page: String(page), limit: String(Math.min(100, Math.max(1, limit))) });
      if (search.trim()) q.set('search', search.trim());
      return authorized(`/attendance/sessions/${encodeURIComponent(id)}/candidates?${q}`);
    },
    async scan(session, value) {
      guardOpen(session);
      const token = extractAttendanceQrToken(value);
      if (!token) throw new ApiError('This is not an issued AZM.AIO attendance QR link. Nothing was marked.', 400, 'UNRECOGNIZED_QR');
      return authorized('/attendance/scan', { method: 'POST', body: { sessionId: session.id, revision: session.revision, qrToken: token, status: 'PRESENT' }, timeoutMs: 15000 });
    },
    async manualPresent(session, studentId) {
      guardOpen(session);
      if (!studentId) throw new ApiError('Select a roster candidate before manual verification.');
      return authorized(`/attendance/sessions/${encodeURIComponent(session.id)}/mark`, { method: 'POST', body: { revision: session.revision, studentId, status: 'PRESENT' }, timeoutMs: 15000 });
    },
    async closeSession(session, markRemainingAbsent) {
      guardOpen(session);
      if (!['SUPER_ADMIN','ADMIN'].includes(currentUser?.role)) throw new ApiError('Only an administrator can close a session.', 403);
      return authorized(`/attendance/sessions/${encodeURIComponent(session.id)}/close`, { method: 'POST', body: { markRemainingAbsent: Boolean(markRemainingAbsent) }, timeoutMs: 20000 });
    },
  };
}
