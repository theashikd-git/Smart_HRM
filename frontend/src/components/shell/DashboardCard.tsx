import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type CardTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<CardTone, string> = {
  default: 'text-text-secondary bg-surface-sunken',
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  danger: 'text-danger bg-danger-soft',
  info: 'text-info bg-info-soft',
};

interface DashboardCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  secondary?: string;
  tone?: CardTone;
}

export function DashboardCard({ icon: Icon, label, value, secondary, tone = 'default' }: DashboardCardProps) {
  return (
    <div className="flex items-center gap-3 rounded border border-line bg-white px-3.5 py-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded', TONE_STYLES[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted truncate">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold text-text-primary leading-tight">{value}</span>
          {secondary && <span className="text-[11px] text-text-muted truncate">{secondary}</span>}
        </div>
      </div>
    </div>
  );
}
