/**
 * Token and user session management helper.
 * Completely Cookie-Free: Uses pure JWT Bearer tokens in Authorization headers.
 */

const TOKEN_KEY = 'jps_access_token';
const REFRESH_TOKEN_KEY = 'jps_refresh_token';
const USER_KEY = 'jps_current_user';

export function wipeAllCookies(): void {
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      }
    }
  } catch (e) {}
}

export function purgeLegacyDataCaches(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const legacyKeys = [
        'AZM_REGISTERED_STUDENTS_V',
        'AZM_PAID_STUDENT_IDS_V',
        'AZM_STUDENT_UPLOADED_FILES_V',
        'AZM_STUDENT_DOCS_V',
        'AZM_EXAM_HALLS_V',
        'AZM_PAID_FEE_KEYS_V',
        'AZM_STAFF_V',
        'AZM_PAYROLL_V',
        'AZM_TRANSACTIONS_V',
        'AZM_PARTNERS_V',
        'AZM_HALL_ASSIGNMENTS_V',
        'AZM_SEAT_ALLOCATIONS_V',
        'AZM_ATTENDANCE_V',
        'AZM_TEST_CENTERS_V',
        'AZM_ROLL_NUMBER_SCHEDULE_V',
        'AZM_ROLL_NUMBER_RELEASE_CONFIG_V',
      ];
      legacyKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
      });
    }
  } catch (e) {}
}

// Purge any cookies & legacy data caches immediately on load
wipeAllCookies();
purgeLegacyDataCaches();

export const authStorage = {
  setToken(token: string): void {
    wipeAllCookies();
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // fallback in case storage is restricted
    }
  },

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  clearToken(): void {
    wipeAllCookies();
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },

  setRefreshToken(token: string): void {
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch {}
  },

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  clearRefreshToken(): void {
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {}
  },

  setUser(user: any): void {
    wipeAllCookies();
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  },

  getUser<T = any>(): T | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clearUser(): void {
    wipeAllCookies();
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
  },

  clearAll(): void {
    wipeAllCookies();
    this.clearToken();
    this.clearRefreshToken();
    this.clearUser();
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

export const setToken = authStorage.setToken.bind(authStorage);
export const getToken = authStorage.getToken.bind(authStorage);
export const clearToken = authStorage.clearToken.bind(authStorage);
export const setRefreshToken = authStorage.setRefreshToken.bind(authStorage);
export const getRefreshToken = authStorage.getRefreshToken.bind(authStorage);
export const clearRefreshToken = authStorage.clearRefreshToken.bind(authStorage);
export const setUser = authStorage.setUser.bind(authStorage);
export const getUser = authStorage.getUser.bind(authStorage);
export const clearUser = authStorage.clearUser.bind(authStorage);
export const clearAll = authStorage.clearAll.bind(authStorage);
export const isAuthenticated = authStorage.isAuthenticated.bind(authStorage);
