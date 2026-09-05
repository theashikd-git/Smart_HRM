'use client';

import { useState } from 'react';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/85 backdrop-blur px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-2.5 py-1.5 hover:bg-surface-sunken transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent-dark">
            <UserIcon className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-text-primary leading-tight">{user?.fullName || '—'}</p>
            <p className="text-[10px] text-text-muted leading-tight">{user?.role}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-line bg-white shadow-popover py-1">
              <button
                onClick={() => logout()}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-soft transition-colors',
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
