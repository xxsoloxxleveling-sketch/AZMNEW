import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './authContext';

export type DashboardTheme = 'light' | 'dark';

type ThemeContextValue = {
  theme: DashboardTheme;
  setTheme: (nextTheme: DashboardTheme) => void;
};

type StoredSelection = { accountId: string; theme: DashboardTheme };
const STORAGE_PREFIX = 'azmaio.dashboard.appearance.v1:';
const DashboardThemeContext = createContext<ThemeContextValue | null>(null);

const themeKey = (accountId: string) => STORAGE_PREFIX + accountId;

function readTheme(accountId: string): DashboardTheme {
  if (!accountId || typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(themeKey(accountId)) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Dashboard-only preference, on this browser and scoped to the signed-in account. */
export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const accountId = user?.id ?? '';
  const [selection, setSelection] = useState<StoredSelection>(() => ({
    accountId,
    theme: readTheme(accountId),
  }));
  // Never display the previous account's preference during a staff account switch.
  const theme = selection.accountId === accountId ? selection.theme : readTheme(accountId);

  const setTheme = useCallback((nextTheme: DashboardTheme) => {
    if (!accountId || (nextTheme !== 'dark' && nextTheme !== 'light')) return;
    setSelection({ accountId, theme: nextTheme });
    try {
      window.localStorage.setItem(themeKey(accountId), nextTheme);
    } catch {
      // Storage can be disabled. The selected theme still works for this session.
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const syncOtherTabs = (event: StorageEvent) => {
      if (event.key === themeKey(accountId) || event.key === null) {
        setSelection({ accountId, theme: readTheme(accountId) });
      }
    };
    window.addEventListener('storage', syncOtherTabs);
    return () => window.removeEventListener('storage', syncOtherTabs);
  }, [accountId]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return (
    <DashboardThemeContext.Provider value={value}>
      {children}
    </DashboardThemeContext.Provider>
  );
}

export function useDashboardTheme(): ThemeContextValue {
  const value = useContext(DashboardThemeContext);
  if (!value) throw new Error('Dashboard theme must be used inside AdminLayout.');
  return value;
}
