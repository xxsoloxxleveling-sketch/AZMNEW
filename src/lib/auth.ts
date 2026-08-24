/**
 * Token and user session management helper.
 * Completely Cookie-Free: Uses pure JWT Bearer tokens in Authorization headers.
 */

const TOKEN_KEY = 'jps_access_token';
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

// Purge any cookies immediately on load
wipeAllCookies();

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
    this.clearUser();
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

export const setToken = authStorage.setToken.bind(authStorage);
export const getToken = authStorage.getToken.bind(authStorage);
export const clearToken = authStorage.clearToken.bind(authStorage);
export const setUser = authStorage.setUser.bind(authStorage);
export const getUser = authStorage.getUser.bind(authStorage);
export const clearUser = authStorage.clearUser.bind(authStorage);
export const clearAll = authStorage.clearAll.bind(authStorage);
export const isAuthenticated = authStorage.isAuthenticated.bind(authStorage);
