'use client';

import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { useAuthStore } from '@/lib/auth-store';
import type { ModuleDefinition } from '@/types/workbench';
import { NotificationMenu } from './NotificationMenu';
import { UserMenu } from './UserMenu';

const MODULES: ModuleDefinition[] = [
  { id: 'personnel', label: 'Personnel', enabled: true },
  { id: 'leave', label: 'Leave', enabled: true },
  { id: 'device', label: 'Device', enabled: true },
  { id: 'payroll', label: 'Payroll', enabled: false },
  { id: 'system-settings', label: 'System Settings', enabled: true, roles: ['ADMIN'] },
];

export function TopNavigation() {
  const activeModule = useWorkbenchStore((s) => s.activeModule);
  const setActiveModule = useWorkbenchStore((s) => s.setActiveModule);
  const user = useAuthStore((s) => s.user);
  const visibleModules = MODULES.filter((mod) => !mod.roles || (user && mod.roles.includes(user.role)));

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-ink-line/40 bg-ink px-3 text-white">
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-white/10">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight hidden sm:inline">Smart HRM</span>
        </div>

        <nav className="flex items-center gap-0.5" aria-label="Top level modules">
          {visibleModules.map((mod) => {
            const active = mod.id === activeModule;
            return (
              <button
                key={mod.id}
                type="button"
                disabled={!mod.enabled}
                onClick={() => mod.enabled && setActiveModule(mod.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative px-3 h-12 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                  active ? 'text-white' : 'text-white/60',
                  mod.enabled ? 'hover:text-white hover:bg-white/5' : 'cursor-not-allowed opacity-40',
                )}
              >
                {mod.label}
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                {!mod.enabled && (
                  <span className="ml-1.5 rounded bg-white/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/50">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        <NotificationMenu />
        <UserMenu />
      </div>
    </header>
  );
}
