'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, Clock3, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Bell icon for the Employee Portal's top-right nav, mirroring the
 * Workbench's NotificationMenu placement/shell but wired to a real feed:
 * leave-request status changes and roster/shift assignment changes for
 * this employee (see backend NotificationsService, populated from
 * LeaveService.approve/reject and RosterService.upsert/remove).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  function handleItemClick(n: AppNotification) {
    if (!n.isRead) markRead.mutate(n.id);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-md border border-line bg-white shadow-popover">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-xs font-semibold text-text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-dark"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-text-muted">
                No leave or shift updates yet.
              </div>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={cn(
                  'flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-sunken',
                  !n.isRead && 'bg-accent-soft/40',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    n.category === 'LEAVE' ? 'bg-accent-soft text-accent-dark' : 'bg-info-soft text-info',
                  )}
                >
                  {n.category === 'LEAVE' ? <CalendarDays className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold text-text-primary">{n.title}</p>
                    {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-text-secondary">{n.message}</p>
                  <p className="mt-1 text-[10px] text-text-muted">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
