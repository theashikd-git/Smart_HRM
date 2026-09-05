'use client';

import { create } from 'zustand';
import { api } from './api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('smart_hrm_token');
    const userStr = localStorage.getItem('smart_hrm_user');
    set({
      token: token || null,
      user: userStr ? JSON.parse(userStr) : null,
      hydrated: true,
    });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { accessToken, user } = res.data;
      localStorage.setItem('smart_hrm_token', accessToken);
      localStorage.setItem('smart_hrm_user', JSON.stringify(user));
      set({ token: accessToken, user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem('smart_hrm_token');
    localStorage.removeItem('smart_hrm_user');
    set({ token: null, user: null });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },
}));
