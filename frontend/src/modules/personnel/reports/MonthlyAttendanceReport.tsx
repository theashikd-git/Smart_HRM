'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Printer } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useMonthlyRecords, useAttendanceDetail } from '@/hooks/useReports';
import { useDepartments } from '@/hooks/useDepartments';
import { useCompany } from '@/hooks/useCompany';
import { downloadCsv, printTable } from '@/lib/report-export';

const HEADERS = ['Employee', 'Employee ID', 'Department', 'Present', 'Late', 'Half Day', 'Leave', 'Absent', 'Late (min)', 'Overtime (min)', 'Work Hours'];

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

/**
 * Attendance > Monthly Attendance: one line per employee for the chosen
 * month -- days present / late / half day / on leave / absent, plus total late
 * and overtime minutes and hours worked. Built from the month's attendance
 * rows, with Absent worked out the same way as the Absent report.
 */
export function MonthlyAttendanceReport() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [department, setDepartment] = useState('');
  const { data: departments } = useDepartments();
  const { data: company } = useCompany();
  const { data: records, isLoading } = useMonthlyRecords(month);
  const { start, end } = monthBounds(month);
  const { data: absent } = useAttendanceDetail({ type: 'absent', startDate: start, endDate: end });

  const rows = useMemo(() => {
    const map = new Map<
      string,
      { name: string; code: string; dept: string; present: number; late: number; half: number; leave: number; absent: number; lateMin: number; otMin: number; hours: number }
    >();
    const get = (id: string, name: string, code: string, dept: string) => {
      if (!map.has(id)) map.set(id, { name, code, dept, present: 0, late: 0, half: 0, leave: 0, absent: 0, lateMin: 0, otMin: 0, hours: 0 });
      return map.get(id)!;
    };
    for (const r of records ?? []) {
      const e = get(r.employeeId, r.employee.fullName, r.employee.employeeCode, r.employee.department?.name ?? '');
      if (r.status === 'PRESENT') e.present++;
      else if (r.status === 'LATE') e.late++;
      else if (r.status === 'HALF_DAY') e.half++;
      else if (r.status === 'ON_LEAVE') e.leave++;
      e.lateMin += r.lateMinutes ?? 0;
      e.otMin += r.overtimeMinutes ?? 0;
      e.hours += Number(r.workHours ?? 0);
    }
    for (const a of absent?.rows ?? []) {
      get(a.employeeId, a.employeeName, a.employeeCode, a.department ?? '').absent++;
    }
    return [...map.values()]
      .filter((e) => !department || e.dept === department)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [records, absent, department]);

  const table = rows.map((e) => [
    e.name,
    e.code,
    e.dept,
    String(e.present),
    String(e.late),
    String(e.half),
    String(e.leave),
    String(e.absent),
    String(e.lateMin),
    String(e.otMin),
    e.hours.toFixed(1),
  ]);

  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <>
      <Card className="mb-4 p-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FieldWrap label="Month">
            <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Department">
            <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <div className="flex items-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                rows.length ? downloadCsv(`monthly-attendance_${month}.csv`, HEADERS, table) : toast('Nothing to export.')
              }
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!rows.length) return toast('Nothing to print.');
                const ok = printTable({
                  company: company?.name,
                  title: 'Monthly Attendance',
                  subtitle: `${monthLabel} -- ${department || 'All Departments'}`,
                  headers: HEADERS,
                  rows: table,
                  rightAlign: [3, 4, 5, 6, 7, 8, 9, 10],
                });
                if (!ok) toast.error('Allow pop-ups for this site to print.');
              }}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h3 className="text-sm font-semibold text-text-primary">Monthly Attendance · {monthLabel}</h3>
          <p className="text-xs text-text-secondary">{rows.length} employees</p>
        </div>
        <Table>
          <Thead>
            <tr>
              {HEADERS.map((h, i) => (
                <Th key={h} className={i >= 3 ? 'text-right' : undefined}>
                  {h}
                </Th>
              ))}
            </tr>
          </Thead>
          <Tbody>
            {table.map((r, idx) => (
              <Tr key={rows[idx].code + idx}>
                {r.map((c, i) => (
                  <Td key={i} className={i >= 3 ? 'text-right' : undefined}>
                    {c}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-xs text-text-muted">Loading…</div>
        ) : (
          rows.length === 0 && <EmptyState title="No attendance for this month" subtitle="Try another month or department." />
        )}
      </Card>
    </>
  );
}
