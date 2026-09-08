'use client';

import { Clock, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useAttendance } from '@/hooks/useAttendance';
import type { Employee } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
}

function formatDateLabel(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function formatTimeWithSeconds(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Zero-padded "09h 04m 11s" duration between a check-in and check-out --
 *  matches the exact format requested for the attendance popup, distinct
 *  from the non-padded "9h 4m" used elsewhere (lib/utils.ts minutesToHm). */
function formatDuration(checkIn?: string | null, checkOut?: string | null): string {
  if (!checkIn || !checkOut) return '—';
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '—';
  const totalSeconds = Math.floor((end - start) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

/** Daily check-in/check-out pairs for one employee -- reads AttendanceRecord
 *  (already one row per employee per day, produced by AttendanceService.
 *  processDay() from the raw device punches) rather than individual
 *  fingerprint punches, per the requested design. */
export function AttendanceHistoryModal({ open, onClose, employee }: Props) {
  const { data, isLoading } = useAttendance(
    { employeeId: employee?.id, pageSize: 60 },
    { enabled: open && !!employee },
  );

  return (
    <Modal
      open={open && !!employee}
      onClose={onClose}
      title="Attendance History"
      subtitle={employee ? `${employee.fullName} · ${employee.employeeCode}` : undefined}
      size="lg"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Clock className="h-8 w-8" />}
          title="No attendance records"
          subtitle="Punches from the biometric device will appear here once synced."
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Date</Th>
              <Th>Check In Time</Th>
              <Th>Check Out Time</Th>
              <Th>Total Duration</Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.items.map((rec) => (
              <Tr key={rec.id}>
                <Td>{formatDateLabel(rec.date)}</Td>
                <Td>{formatTimeWithSeconds(rec.checkIn)}</Td>
                <Td>{formatTimeWithSeconds(rec.checkOut)}</Td>
                <Td className="font-medium">{formatDuration(rec.checkIn, rec.checkOut)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Modal>
  );
}
