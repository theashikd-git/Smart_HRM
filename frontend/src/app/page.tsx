'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, homeRouteForRole } from '@/lib/auth-store';

export default function Home() {
  const router = useRouter();
  const { hydrate, token, user, hydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    router.replace(homeRouteForRole(user?.role));
  }, [hydrated, token, user, router]);

  return null;
}
