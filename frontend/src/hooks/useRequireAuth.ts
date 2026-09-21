'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, homeRouteForRole } from '@/lib/auth-store';

type Area = 'staff' | 'employee' | 'manager' | 'supervisor';

function inArea(area: Area, role?: string | null) {
  if (area === 'employee') return role === 'EMPLOYEE';
  if (area === 'manager') return role === 'MANAGER';
  if (area === 'supervisor') return role === 'SUPERVISOR';
  return role !== 'EMPLOYEE' && role !== 'MANAGER' && role !== 'SUPERVISOR';
}

/** Guards a route behind login, and keeps each login type at its own home:
 *  ADMIN/HR/MANAGING_DIRECTOR use /workbench (area 'staff'), MANAGER uses
 *  /manager-portal (area 'manager'), SUPERVISOR uses /supervisor-portal
 *  (area 'supervisor'), EMPLOYEE uses /employee-portal (area 'employee').
 *  `area` says which one this route belongs to, so a signed-in user who
 *  lands in the wrong area (e.g. a Supervisor hitting /manager-portal, or
 *  an employee hitting /workbench) is bounced to their own home via
 *  homeRouteForRole instead of seeing a screen that was never meant for
 *  them. Defaults to 'staff' so existing callers (AppShellRoot) don't need
 *  to change. */
export function useRequireAuth(area: Area = 'staff') {
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
    if (user && !inArea(area, user.role)) {
      router.replace(homeRouteForRole(user.role));
    }
  }, [hydrated, token, user, area, router]);

  const inRightArea = !!user && inArea(area, user.role);
  return { ready: hydrated && !!token && (!!user ? inRightArea : true) };
}
