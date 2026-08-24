/**
 * Token and user session management helper.
 * Centralized so swapping between localStorage, sessionStorage, or httpOnly cookies in Phase 7
 * requires changing only this file rather than updating multiple components.
 */

const TOKEN_KEY = 'jps_access_token';
const USER_KEY = 'jps_current_user';

export const authStorage = {
  setToken(token: string): void {
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
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },

  setUser(user: any): void {
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
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
  },

  clearAll(): void {
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
