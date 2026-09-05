import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  Present: 'text-success bg-success-soft',
  Late: 'text-warning bg-warning-soft',
  Absent: 'text-danger bg-danger-soft',
  Leave: 'text-info bg-info-soft',
  Off: 'text-text-muted bg-surface-sunken',
  Overtime: 'text-info bg-info-soft',
  'Early Out': 'text-warning bg-warning-soft',
  'Missing Punch': 'text-danger bg-danger-soft',
  Active: 'text-success bg-success-soft',
  Probation: 'text-warning bg-warning-soft',
  Inactive: 'text-text-muted bg-surface-sunken',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_STYLES[status] ?? 'text-text-secondary bg-surface-sunken',
        className,
      )}
    >
      {status}
    </span>
  );
}
