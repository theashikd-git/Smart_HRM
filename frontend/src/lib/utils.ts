import { clsx, ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export const employeeStatusColors: Record<string, { text: string; bg: string; dot: string }> = {
  ACTIVE: { text: 'text-success', bg: 'bg-success-soft', dot: 'bg-success' },
  INACTIVE: { text: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-warning' },
  TERMINATED: { text: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-danger' },
};

export const syncStatusColors: Record<string, { text: string; bg: string; dot: string }> = {
  SYNCED: { text: 'text-success', bg: 'bg-success-soft', dot: 'bg-success' },
  PENDING: { text: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-warning' },
  FAILED: { text: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-danger' },
  NOT_SYNCED: { text: 'text-text-muted', bg: 'bg-surface-sunken', dot: 'bg-text-muted' },
};

export const attendanceStatusColors: Record<string, { text: string; bg: string; dot: string }> = {
  PRESENT: { text: 'text-success', bg: 'bg-success-soft', dot: 'bg-success' },
  LATE: { text: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-warning' },
  ABSENT: { text: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-danger' },
  HALF_DAY: { text: 'text-info', bg: 'bg-info-soft', dot: 'bg-info' },
  ON_LEAVE: { text: 'text-accent', bg: 'bg-accent-soft', dot: 'bg-accent' },
  HOLIDAY: { text: 'text-text-secondary', bg: 'bg-surface-sunken', dot: 'bg-text-muted' },
};

export const deviceStatusColors: Record<string, { text: string; bg: string; dot: string }> = {
  ONLINE: { text: 'text-success', bg: 'bg-success-soft', dot: 'bg-success' },
  OFFLINE: { text: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-danger' },
  UNKNOWN: { text: 'text-text-muted', bg: 'bg-surface-sunken', dot: 'bg-text-muted' },
};

export function minutesToHm(minutes: number): string {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const leaveStatusColors: Record<string, { text: string; bg: string; dot: string }> = {
  PENDING: { text: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-warning' },
  APPROVED: { text: 'text-success', bg: 'bg-success-soft', dot: 'bg-success' },
  REJECTED: { text: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-danger' },
  CANCELLED: { text: 'text-text-muted', bg: 'bg-surface-sunken', dot: 'bg-text-muted' },
};
