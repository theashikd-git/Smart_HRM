'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

/** Guards a route behind login, and keeps staff (ADMIN/HR/MANAGER) and
 *  EMPLOYEE self-service accounts in their own area of the app -- staff use
 *  /workbench, employees use /employee-portal. `area` says which one this
 *  route belongs to, so a signed-in user who lands in the wrong area (e.g.
 *  an employee hitting /workbench directly) is bounced to their own home
 *  instead of seeing a screen that was never meant for them. Defaults to
 *  'staff' so existing callers (AppShellRoot) don't need to change. */
export function useRequireAuth(area: 'staff' | 'employee' = 'staff') {
  const router = useRouter();
  const { token, user, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (area === 'staff' && user?.role === 'EMPLOYEE') {
      router.replace('/employee-portal');
    } else if (area === 'employee' && user && user.role !== 'EMPLOYEE') {
      router.replace('/workbench');
    }
  }, [hydrated, token, user, area, router]);

  const inRightArea = area === 'staff' ? user?.role !== 'EMPLOYEE' : user?.role === 'EMPLOYEE';
  return { ready: hydrated && !!token && (!!user ? inRightArea : true) };
}
