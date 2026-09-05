'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { initials } from '@/lib/utils';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const name = user?.fullName || 'Account';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-md px-1.5 pr-2 text-white/85 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/80 text-[11px] font-semibold text-white">
          {initials(name) || '?'}
        </div>
        <span className="hidden text-xs font-medium sm:inline">{name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/50" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 rounded-md border border-line bg-white py-1 shadow-popover">
          <div className="border-b border-line px-3 py-2">
            <p className="text-xs font-medium text-text-primary">{name}</p>
            <p className="text-[11px] text-text-muted">{user?.email || '—'}</p>
            {user?.role && <p className="text-[11px] text-text-muted mt-0.5">{user.role}</p>}
          </div>
          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary hover:bg-surface-sunken">
            <User className="h-3.5 w-3.5" /> My Profile
          </button>
          <div className="my-1 border-t border-line" />
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger hover:bg-danger-soft"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
