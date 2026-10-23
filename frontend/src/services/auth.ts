import { API_BASE } from './api';
import { User, TokenResponse, TOTPSetupResponse } from '../types';

const TOKEN_KEY = 'quizforge_jwt_token';
const USER_KEY = 'quizforge_user_profile';

export const authService = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getUser: (): User | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  logout: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch {
        // ignore network error on logout
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  isAdmin: (): boolean => {
    const user = authService.getUser();
    return user?.role === 'admin';
  },

  login: async (credentials: { email_or_username: string; password: string }): Promise<TokenResponse> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed. Please check your credentials.');
    }
    const data: TokenResponse = await res.json();
    authService.setToken(data.access_token);
    authService.setUser(data.user);
    return data;
  },

  signup: async (data: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    admin_totp_code: string;
    gemini_api_key?: string;
  }): Promise<TokenResponse> => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Sign up failed.');
    }
    const tokenData: TokenResponse = await res.json();
    authService.setToken(tokenData.access_token);
    authService.setUser(tokenData.user);
    if (data.gemini_api_key && data.gemini_api_key.trim()) {
      localStorage.setItem('quizforge_user_gemini_key', data.gemini_api_key.trim());
    }
    return tokenData;
  },

  forgotPasswordReset: async (data: {
    email_or_username: string;
    admin_totp_code: string;
    new_password: string;
  }): Promise<TokenResponse> => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Password reset failed.');
    }
    const tokenData: TokenResponse = await res.json();
    authService.setToken(tokenData.access_token);
    authService.setUser(tokenData.user);
    return tokenData;
  },

  getMe: async (): Promise<User> => {
    const token = authService.getToken();
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      authService.logout();
      throw new Error('Session expired');
    }
    const user: User = await res.json();
    authService.setUser(user);
    return user;
  },

  getTotpSetup: async (): Promise<TOTPSetupResponse> => {
    const res = await fetch(`${API_BASE}/auth/totp-setup`);
    if (!res.ok) throw new Error('Failed to load TOTP setup');
    return res.json();
  }
};
