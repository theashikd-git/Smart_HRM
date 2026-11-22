'use client';

import { create } from 'zustand';
import { api } from './api';
import { clearPersistedWorkbench } from '@/hooks/useWorkbenchStore';
import { User, Role } from '@/types';

// Where a signed-in login's browser tab should land -- kept in one place so
// /login, / and useRequireAuth never disagree about it. EMPLOYEE goes to the
// Employee Portal; MANAGER and SUPERVISOR each get their own URL --
// /manager-portal and /supervisor-portal -- though both render the exact
// same ManagerPortalView component with the exact same tabs (only the
// header badge text differs); SUPERVISOR's narrower permissions are
// enforced server-side, not by giving it a different portal. Everyone else
// (ADMIN/HR/MANAGING_DIRECTOR) gets the full Admin/HR area at /hradmin-portal.
export function homeRouteForRole(role?: Role | null): string {
  if (role === 'EMPLOYEE') return '/employee-portal';
  if (role === 'MANAGER') return '/manager-portal';
  if (role === 'SUPERVISOR') return '/supervisor-portal';
  return '/hradmin-portal';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hydrated: boolean;
  hydrate: () => void;
  login: (username: string, password: string) => Promise<void>;
  employeeLogin: (employeeCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Patches the signed-in user's own record (e.g. after changing their
   *  password clears mustChangePassword) without a full re-login. */
  setUser: (user: User) => void;
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
    // A damaged saved session (empty, "undefined", cut-off JSON...) must not
    // crash the page: treat it as signed out and clear it.
    let user: User | null = null;
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        user = parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        user = null;
      }
    }
    if (!token || !user) {
      localStorage.removeItem('smart_hrm_token');
      localStorage.removeItem('smart_hrm_user');
      set({ token: null, user: null, hydrated: true });
      return;
    }
    set({ token, user, hydrated: true });
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { username, password });
      const { accessToken, user } = res.data ?? {};
      if (!accessToken || !user) throw new Error('Unexpected reply from the server. Check that the API address is correct.');
      localStorage.setItem('smart_hrm_token', accessToken);
      localStorage.setItem('smart_hrm_user', JSON.stringify(user));
      set({ token: accessToken, user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // Employee self-service login -- by Employee ID (Employee Code), not
  // email. Separate backend endpoint, same session/token shape afterwards,
  // so the rest of the app (api interceptor, logout, hydrate) never needs
  // to know which door the user came in through.
  employeeLogin: async (employeeCode: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/employee-login', { employeeCode, password });
      const { accessToken, user } = res.data ?? {};
      if (!accessToken || !user) throw new Error('Unexpected reply from the server. Check that the API address is correct.');
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
    // So the next person to sign in on this browser starts with a clean
    // Workbench instead of inheriting whatever tabs this user had open.
    clearPersistedWorkbench();
    set({ token: null, user: null });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  setUser: (user: User) => {
    if (typeof window !== 'undefined') localStorage.setItem('smart_hrm_user', JSON.stringify(user));
    set({ user });
  },
}));
