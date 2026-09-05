'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

export function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <Bell className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 rounded-md border border-line bg-white shadow-popover">
          <div className="border-b border-line px-3 py-2 text-xs font-semibold text-text-primary">Notifications</div>
          <div className="px-3 py-6 text-center text-xs text-text-muted">
            The notification engine hasn&apos;t been built yet.
          </div>
        </div>
      )}
    </div>
  );
}
