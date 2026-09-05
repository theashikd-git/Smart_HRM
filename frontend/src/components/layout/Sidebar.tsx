'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  IdCard,
  Clock,
  CalendarCheck,
  CalendarDays,
  Fingerprint,
  FileBarChart,
  ScrollText,
  Settings,
  ShieldCheck,
  GitBranch,
  MapPin,
  Network,
  LayoutGrid,
  Layers,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/employees', label: 'Employees', icon: Users, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/branches', label: 'Branches', icon: GitBranch, roles: ['ADMIN', 'HR'] },
  { href: '/locations', label: 'Locations', icon: MapPin, roles: ['ADMIN', 'HR'] },
  { href: '/departments', label: 'Departments', icon: Building2, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/sub-departments', label: 'Sub-Departments', icon: Network, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/sections', label: 'Sections', icon: LayoutGrid, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/designations', label: 'Designations', icon: IdCard, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/grades', label: 'Grades', icon: Layers, roles: ['ADMIN', 'HR'] },
  { href: '/department-superiors', label: 'Dept. Superiors', icon: UserCog, roles: ['ADMIN', 'HR'] },
  { href: '/shifts', label: 'Shifts', icon: Clock, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/leave', label: 'Leave', icon: CalendarDays, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/device', label: 'Device', icon: Fingerprint, roles: ['ADMIN', 'HR'] },
  { href: '/reports', label: 'Reports', icon: FileBarChart, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: ['ADMIN'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-ink text-white h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <ShieldCheck className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Smart HRM</p>
          <p className="text-[11px] text-white/50 leading-tight">Biometric HR Platform</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {NAV_ITEMS.filter((item) => !user || item.roles.includes(user.role)).map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-white'
                  : 'text-white/65 hover:bg-ink-soft hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-ink-line/40">
        <p className="text-[11px] text-white/40">Smart HRM v1.0</p>
        <p className="text-[11px] text-white/40">ZKTeco uFace 800 Plus</p>
      </div>
    </aside>
  );
}
