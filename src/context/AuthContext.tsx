'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role } from '@/types';

const TAB_TOKEN_KEY = 'rsu_tab_auth_token';

// Patch window.fetch once so every /api/* call from this tab automatically sends this tab's own Bearer token.
// This isolates sessions per browser tab so opening multiple Roles in different tabs never overwrites each other.
let fetchPatched = false;
function installTabAuthFetchInterceptor() {
  if (typeof window === 'undefined' || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.pathname
          : input.url;
      const isApiCall =
        urlStr.startsWith('/api/') ||
        urlStr.startsWith(`${window.location.origin}/api/`);

      if (isApiCall) {
        const tabToken = window.sessionStorage.getItem(TAB_TOKEN_KEY);
        if (tabToken) {
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : undefined)
          );
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${tabToken}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      }
    } catch {
      // Fall through to native fetch
    }
    return originalFetch(input, init);
  };
}

if (typeof window !== 'undefined') {
  installTabAuthFetchInterceptor();
}

export interface AuthUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: Role;
  studentId?: string;
  scholarshipTypeId?: string;
  scholarshipName?: string;
  targetHours?: number;
  faculty?: string;
  major?: string;
  phone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (formData: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const saveTabToken = (token?: string) => {
    if (typeof window !== 'undefined' && token) {
      try {
        window.sessionStorage.setItem(TAB_TOKEN_KEY, token);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const clearTabToken = () => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(TAB_TOKEN_KEY);
      } catch {
        // Ignore
      }
    }
  };

  const refreshUser = async () => {
    installTabAuthFetchInterceptor();
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.token && typeof window !== 'undefined' && !window.sessionStorage.getItem(TAB_TOKEN_KEY)) {
          saveTabToken(data.token);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    installTabAuthFetchInterceptor();
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    installTabAuthFetchInterceptor();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'เข้าสู่ระบบไม่สำเร็จ' };
      }
      saveTabToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' };
    }
  };

  const register = async (formData: any) => {
    installTabAuthFetchInterceptor();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'ลงทะเบียนไม่สำเร็จ' };
      }
      saveTabToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' };
    }
  };

  const logout = async () => {
    clearTabToken();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
