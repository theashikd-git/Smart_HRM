'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Printer, RotateCcw, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { StatusBadge } from '@/components/shell/StatusBadge';
import { useAttendanceDetail, type AttendanceDetailRow, type AttendanceDetailType } from '@/hooks/useReports';
import { useDepartments } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { useShifts } from '@/hooks/useShifts';
import { useCompany } from '@/hooks/useCompany';
import { apiErrorMessage } from '@/lib/api';
import { downloadCsv, printTable } from '@/lib/report-export';
import { formatDate, formatTime } from '@/lib/utils';
import { ATTENDANCE_STATUS_LABEL } from '../attendance/AttendanceReport';

interface Col {
  header: string;
  text: (r: AttendanceDetailRow) => string;
  align?: 'right';
  badge?: boolean;
}

const date: Col = { header: 'Date', text: (r) => formatDate(r.date) };
const who: Col[] = [
  { header: 'Employee', text: (r) => r.employeeName },
  { header: 'Employee ID', text: (r) => r.employeeCode },
  { header: 'Department', text: (r) => r.department ?? '' },
  { header: 'Shift', text: (r) => r.shift ?? '' },
];
const status: Col = { header: 'Status', text: (r) => ATTENDANCE_STATUS_LABEL[r.status] ?? r.status, badge: true };
const mins = (n: number) => `${n} min`;

const REPORTS: Record<AttendanceDetailType, { title: string; empty: string; cols: Col[] }> = {
  late: {
    title: 'Late Report',
    empty: 'Nobody was late in this period.',
    cols: [
      date,
      ...who,
      { header: 'Scheduled In', text: (r) => r.scheduledIn ?? '' },
      { header: 'Actual In', text: (r) => formatTime(r.checkIn) },
      { header: 'Late', text: (r) => mins(r.lateMinutes), align: 'right' },
      status,
    ],
  },
  absent: {
    title: 'Absent Report',
    empty: 'Nobody was absent in this period.',
    cols: [
      date,
      ...who,
      { header: 'Scheduled In', text: (r) => r.scheduledIn ?? '' },
      { header: 'Reason', text: (r) => r.note ?? '' },
      status,
    ],
  },
  overtime: {
    title: 'Overtime Report',
    empty: 'No overtime in this period.',
    cols: [
      date,
      ...who,
      { header: 'Scheduled Out', text: (r) => r.scheduledOut ?? '' },
      { header: 'Actual Out', text: (r) => formatTime(r.checkOut) },
      { header: 'Overtime', text: (r) => mins(r.overtimeMinutes), align: 'right' },
      status,
    ],
  },
  present: {
    title: 'Present Report',
    empty: 'No attendance in this period.',
    cols: [
      date,
      ...who,
      { header: 'Check In', text: (r) => formatTime(r.checkIn) },
      { header: 'Check Out', text: (r) => formatTime(r.checkOut) },
      { header: 'Work Hours', text: (r) => (r.workHours != null ? r.workHours.toFixed(2) : ''), align: 'right' },
      status,
    ],
  },
  'early-out': {
    title: 'Early Out Report',
    empty: 'Nobody left early in this period.',
    cols: [
      date,
      ...who,
      { header: 'Scheduled Out', text: (r) => r.scheduledOut ?? '' },
      { header: 'Actual Out', text: (r) => formatTime(r.checkOut) },
      { header: 'Early By', text: (r) => mins(r.earlyLeaveMinutes), align: 'right' },
      status,
    ],
  },
  'missing-punch': {
    title: 'Missing Punch Report',
    empty: 'No missing punches in this period.',
    cols: [
      date,
      ...who,
      { header: 'Check In', text: (r) => formatTime(r.checkIn) },
      { header: 'Check Out', text: (r) => formatTime(r.checkOut) },
      { header: 'Missing', text: (r) => r.note ?? '' },
    ],
  },
};

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`;
};
const lastWeek = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: iso(from), to: iso(to) };
};

/**
 * One screen for every attendance report -- Late, Absent, Overtime, Present,
 * Early Out and Missing Punch (Personnel > Reports), and the Late / Absent /
 * Overtime tabs under Attendance. Real data from /reports/attendance-detail:
 * pick a date range, department, employee and shift, press Search, then
 * Export (CSV) or Print. Filters only apply when Search is pressed.
 */
export function AttendanceDetailReport({ reportId }: { reportId: AttendanceDetailType }) {
  const def = REPORTS[reportId];
  const initial = useMemo(lastWeek, []);

  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [applied, setApplied] = useState({ ...initial, departmentId: '', employeeId: '', shiftId: '' });

  const { data: departments } = useDepartments();
  const { data: shifts } = useShifts();
  const { data: employees } = useEmployees({ departmentId: departmentId || undefined, status: 'ACTIVE', pageSize: 1000 });
  const { data: company } = useCompany();

  const { data, isLoading, isFetching, error } = useAttendanceDetail({
    type: reportId,
    startDate: applied.from,
    endDate: applied.to,
    departmentId: applied.departmentId || undefined,
    employeeId: applied.employeeId || undefined,
    shiftId: applied.shiftId || undefined,
  });
  const rows = data?.rows ?? [];

  const invalidRange = !from || !to || to < from;

  function search() {
    if (invalidRange) {
      toast.error('Pick a valid date range.');
      return;
    }
    setApplied({ from, to, departmentId, employeeId, shiftId });
  }
  function reset() {
    const w = lastWeek();
    setFrom(w.from);
    setTo(w.to);
    setDepartmentId('');
    setEmployeeId('');
    setShiftId('');
    setApplied({ ...w, departmentId: '', employeeId: '', shiftId: '' });
  }

  const period = applied.from === applied.to ? formatDate(applied.from) : `${formatDate(applied.from)} – ${formatDate(applied.to)}`;
  const deptName = departments?.find((d) => d.id === applied.departmentId)?.name ?? 'All Departments';
  const headers = def.cols.map((c) => c.header);
  const table = () => rows.map((r) => def.cols.map((c) => c.text(r)));
  const totalMinutes =
    reportId === 'late'
      ? rows.reduce((n, r) => n + r.lateMinutes, 0)
      : reportId === 'overtime'
        ? rows.reduce((n, r) => n + r.overtimeMinutes, 0)
        : reportId === 'early-out'
          ? rows.reduce((n, r) => n + r.earlyLeaveMinutes, 0)
          : null;

  function exportCsv() {
    if (rows.length === 0) return toast('Nothing to export.');
    downloadCsv(`${reportId}-report_${applied.from}_${applied.to}.csv`, headers, table());
  }
  function print() {
    if (rows.length === 0) return toast('Nothing to print.');
    const ok = printTable({
      company: company?.name,
      title: def.title,
      subtitle: `${period} -- ${deptName}`,
      headers,
      rows: table(),
      rightAlign: def.cols.map((c, i) => (c.align === 'right' ? i : -1)).filter((i) => i >= 0),
    });
    if (!ok) toast.error('Allow pop-ups for this site to print.');
  }

  return (
    <>
      <Card className="mb-4 p-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FieldWrap label="From">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </FieldWrap>
          <FieldWrap label="To">
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Department">
            <Select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setEmployeeId('');
              }}
            >
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Employee">
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All Employees</option>
              {employees?.items.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeCode})
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Shift">
            <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">All Shifts</option>
              {shifts?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button size="sm" onClick={search} loading={isFetching} disabled={invalidRange}>
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={print}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{def.title}</h3>
            <p className="text-xs text-text-muted">
              {period} · {deptName}
            </p>
          </div>
          <p className="text-xs text-text-secondary">
            {rows.length} record{rows.length === 1 ? '' : 's'}
            {totalMinutes != null ? ` · ${totalMinutes} min total` : ''}
          </p>
        </div>

        <Table>
          <Thead>
            <tr>
              {def.cols.map((c) => (
                <Th key={c.header} className={c.align === 'right' ? 'text-right' : undefined}>
                  {c.header}
                </Th>
              ))}
            </tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                {def.cols.map((c) => (
                  <Td key={c.header} className={c.align === 'right' ? 'text-right' : undefined}>
                    {c.badge ? <StatusBadge status={c.text(r)} /> : c.text(r)}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>

        {error ? (
          <div className="px-4 py-8 text-center text-xs text-danger">{apiErrorMessage(error)}</div>
        ) : (
          !isLoading && rows.length === 0 && <EmptyState title={def.empty} subtitle="Try a different date range or filter." />
        )}
        {isLoading && <div className="px-4 py-8 text-center text-xs text-text-muted">Loading…</div>}
      </Card>
    </>
  );
}
