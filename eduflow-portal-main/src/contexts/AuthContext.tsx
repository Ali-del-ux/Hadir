import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { apiRequest } from '@/lib/api';

interface LoginResult {
  success: boolean;
  requires2FA?: boolean;
  tempToken?: string;
  tempUserId?: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  verify2FA: (tempToken: string, totpCode: string, tempUserId?: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hadir_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (token) {
      apiRequest('/auth/me')
        .then(data => {
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            localStorage.removeItem('hadir_token');
            localStorage.removeItem('hadir_user');
          }
        })
        .catch(() => {
          localStorage.removeItem('hadir_token');
          localStorage.removeItem('hadir_user');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      if (data.success && data.requires_2fa) {
        setIsLoading(false);
        return {
          success: false,
          requires2FA: true,
          tempToken: data.temp_token,
          tempUserId: data.tempUserId,
        };
      }

      if (data.success && data.token && data.user) {
        setUser(data.user);
        localStorage.setItem('hadir_token', data.token);
        localStorage.setItem('hadir_user', JSON.stringify(data.user));
        setIsLoading(false);
        return { success: true };
      } else {
        setIsLoading(false);
        return { success: false, error: data.message || 'فشل تسجيل الدخول' };
      }
    } catch (error: any) {
      setIsLoading(false);
      if (error && typeof error === 'object' && error.message) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'خطأ في الشبكة، تأكد من أن الخادم يعمل وحاول مرة أخرى' };
    }
  };

  const verify2FA = async (tempToken: string, totpCode: string, tempUserId?: string): Promise<LoginResult> => {
    setIsLoading(true);

    try {
      const data = await apiRequest('/auth/login/2fa', {
        method: 'POST',
        body: JSON.stringify({ temp_token: tempToken, tempUserId, totp_code: totpCode }),
      });

      if (data.success && data.token && data.user) {
        setUser(data.user);
        localStorage.setItem('hadir_token', data.token);
        localStorage.setItem('hadir_user', JSON.stringify(data.user));
        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, error: data.message || 'رمز التحقق الثنائي غير صحيح' };
    } catch (error: any) {
      setIsLoading(false);
      return {
        success: false,
        error: error?.message || 'رمز التحقق الثنائي غير صحيح أو منتهي الصلاحية',
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hadir_user');
    localStorage.removeItem('hadir_token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, verify2FA, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
