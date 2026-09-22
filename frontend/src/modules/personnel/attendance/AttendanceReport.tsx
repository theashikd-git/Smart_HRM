'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { StatusBadge } from '@/components/shell/StatusBadge';
import { useAttendance } from '@/hooks/useAttendance';
import { useDepartments } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { useCompany, type Company } from '@/hooks/useCompany';
import { downloadAttendanceReportPdf } from '@/lib/attendance-report-pdf';
import { formatDate, formatTime } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  ON_LEAVE: 'Leave',
  HOLIDAY: 'Off',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The letterhead + one date-by-date table per employee -- pure
 * presentation, no data fetching, so it can be dropped into more than one
 * place: the Workbench's own Attendance Report screen below
 * (AttendanceReport), and any other screen that already has a filtered
 * `AttendanceRecord[]` in hand. Mirrors the layout of the downloadable PDF
 * (see lib/attendance-report-pdf.ts) so what's on screen is what gets
 * printed: a Name/ID/Department header per employee, the dates selected
 * under it, then a totals line -- works the same for a single person, a
 * whole department, or a plain date range across everyone. Wrap it in a
 * `.print-report` element for the small/tight print typography rules in
 * globals.css to apply.
 */
export function AttendanceReportPrintable({
  company,
  rows,
  periodLabel,
  scopeLabel,
  isLoading,
}: {
  company?: Company | null;
  rows: AttendanceRecord[];
  /** e.g. "Sep 21, 2026" or "Sep 1 - Sep 21, 2026" */
  periodLabel: string;
  /** e.g. "Department: Nursing" or "Employee: Jane Doe (EMP004)" -- appended after the period, omitted if not filtered */
  scopeLabel?: string;
  isLoading?: boolean;
}) {
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; code: string; dept: string; rows: AttendanceRecord[] }>();
    rows.forEach((r) => {
      const key = r.employeeId;
      if (!map.has(key)) {
        map.set(key, {
          name: r.employee?.fullName ?? 'Unknown',
          code: r.employee?.employeeCode ?? '—',
          dept: r.employee?.department?.name ?? '—',
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    });
    const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((g) => g.rows.sort((a, b) => a.date.localeCompare(b.date)));
    return list;
  }, [rows]);

  return (
    <>
      {/* Letterhead -- company logo + name from Personnel > Organization >
          Company. Falls back to just the name (or a placeholder) when no
          logo has been uploaded yet, rather than leaving a broken image. */}
      <div className="flex flex-col items-center border-b border-line pb-3 mb-3 text-center">
        {company?.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo} alt="" className="mb-1.5 h-12 object-contain" />
        )}
        <p className="text-base font-semibold text-text-primary">{company?.name || 'Company Name'}</p>
        {(company?.address || company?.phone || company?.email) && (
          <p className="text-[11px] text-text-muted">
            {[company?.address, company?.phone, company?.email].filter(Boolean).join('  |  ')}
          </p>
        )}
        <h2 className="mt-2 text-sm font-semibold text-text-primary">Attendance Report</h2>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {periodLabel}
          {scopeLabel ? ` -- ${scopeLabel}` : ''}
        </p>
        <p className="text-[10px] text-text-muted">
          Generated {formatDate(new Date())} {formatTime(new Date())}
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.code + g.name} className="mb-4 break-inside-avoid">
          <div className="flex items-center justify-between bg-surface-sunken rounded-md px-2.5 py-1.5 mb-1.5">
            <p className="text-xs font-semibold text-text-primary">{g.name}</p>
            <p className="text-[11px] text-text-muted">
              ID: {g.code} &nbsp;|&nbsp; Dept: {g.dept}
            </p>
          </div>
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th>Day</Th>
                <Th>Check In</Th>
                <Th>Check Out</Th>
                <Th>Work Hours</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {g.rows.map((r) => (
                <Tr key={r.id}>
                  <Td>{formatDate(r.date)}</Td>
                  <Td>{new Date(r.date).toLocaleDateString(undefined, { weekday: 'short' })}</Td>
                  <Td>{formatTime(r.checkIn)}</Td>
                  <Td>{formatTime(r.checkOut)}</Td>
                  <Td>{r.workHours ? `${r.workHours}h` : '—'}</Td>
                  <Td>
                    <StatusBadge status={ATTENDANCE_STATUS_LABEL[r.status] ?? r.status} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      ))}

      {!isLoading && rows.length === 0 && (
        <EmptyState title="No attendance records" subtitle="No punches recorded for this period yet." />
      )}

      {rows.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-[11px] text-text-muted print:mt-2 print:pt-1.5">
          <span>Employees: {groups.length}</span>
          <span>Total: {rows.length}</span>
          {Object.entries(ATTENDANCE_STATUS_LABEL).map(([key, label]) =>
            summary[key] ? (
              <span key={key}>
                {label}: {summary[key]}
              </span>
            ) : null,
          )}
        </div>
      )}
    </>
  );
}

/**
 * Workbench "Personnel > Attendance > Attendance Report" screen -- the
 * standard attendance register. Filter by a date range and, optionally, a
 * department or a single employee (picking an employee narrows to just
 * them regardless of department), then Print/Download PDF. Groups results
 * by employee -- name & ID as a header, the matching dates listed under it
 * -- so the same screen doubles as an individual attendance sheet when
 * scoped to one person. The real, daily-used Attendance page lives at
 * app/attendance/page.tsx (linked from the Sidebar) and has its own
 * Download PDF button reusing the same lib/attendance-report-pdf.ts
 * generator; this screen is this module's own self-contained version,
 * with the on-screen preview to match.
 */
export function AttendanceReport() {
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees({ departmentId: departmentId || undefined, pageSize: 500 });
  const { data: company } = useCompany();
  const { data, isLoading } = useAttendance({
    startDate,
    endDate,
    departmentId: departmentId || undefined,
    employeeId: employeeId || undefined,
    page: 1,
    pageSize: 2000,
  });

  const rows = data?.items ?? [];
  const departmentName = departments?.find((d) => d.id === departmentId)?.name;
  const selectedEmployee = employees?.items.find((e) => e.id === employeeId);

  function periodLabel() {
    if (startDate === endDate) return formatDate(startDate);
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  function scopeLabel() {
    if (selectedEmployee) return `Employee: ${selectedEmployee.fullName} (${selectedEmployee.employeeCode})`;
    if (departmentName) return `Department: ${departmentName}`;
    return undefined;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <FieldWrap label="From">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
          />
        </FieldWrap>
        <FieldWrap label="To">
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
          />
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
            {employees?.items.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.employeeCode})
              </option>
            ))}
          </Select>
        </FieldWrap>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            downloadAttendanceReportPdf({
              company,
              rows,
              periodLabel: periodLabel(),
              scopeLabel: scopeLabel(),
            })
          }
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <div className="print-report p-5">
          <AttendanceReportPrintable
            company={company}
            rows={rows}
            periodLabel={periodLabel()}
            scopeLabel={scopeLabel()}
            isLoading={isLoading}
          />
        </div>
      </Card>
    </div>
  );
}
