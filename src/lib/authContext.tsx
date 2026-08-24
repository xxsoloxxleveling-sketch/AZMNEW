import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurrentUser, Role, mockApi, LoginResponse } from './mockApi';
import { getUser, clearAll, setUser as persistUser } from './auth';

interface AuthContextType {
  user: CurrentUser | null;
  role: Role;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<LoginResponse>;
  logout: () => void;
  switchRole: (role: Role) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(() => getUser<CurrentUser>());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial sync with mockApi / storage
    mockApi.getCurrentUser().then((u) => {
      setUser(u);
      persistUser(u);
      setIsLoading(false);
    });
  }, []);

  const login = async (email: string, pass: string): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const res = await mockApi.login(email, pass);
      setUser(res.user);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAll();
    setUser(null);
  };

  const switchRole = async (newRole: Role) => {
    setIsLoading(true);
    try {
      const u = await mockApi.switchRole(newRole);
      setUser(u);
      persistUser(u);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'SUPER_ADMIN',
        isLoading,
        login,
        logout,
        switchRole,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
