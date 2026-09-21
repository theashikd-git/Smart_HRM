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
 * The letterhead + compact table itself -- pure presentation, no data
 * fetching, so it can be dropped into more than one place: the Workbench's
 * own Attendance Report screen below (AttendanceReport), and the real,
 * daily-used Attendance page's hidden print view (see
 * app/attendance/page.tsx, which renders this same component inside a
 * `hidden print:block` wrapper fed by whatever it already has filtered on
 * screen). Wrap it in a `.print-report` element for the small/tight print
 * typography rules in globals.css to apply -- both callers do this.
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
  /** e.g. a department name, or a status filter -- appended after the period, omitted if not filtered */
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

  return (
    <>
      {/* Letterhead -- company logo + name from System Settings > Company
          Profile. Falls back to just the name (or a placeholder) when no
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
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Attendance Report</h2>
          <p className="text-xs text-text-muted">
            {periodLabel}
            {scopeLabel ? ` -- ${scopeLabel}` : ''}
          </p>
        </div>
        <p className="text-[10px] text-text-muted">
          Generated {formatDate(new Date())} {formatTime(new Date())}
        </p>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Employee</Th>
            <Th>ID</Th>
            <Th>Department</Th>
            <Th>Date</Th>
            <Th>Check In</Th>
            <Th>Check Out</Th>
            <Th>Status</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>{r.employee?.fullName ?? '—'}</Td>
              <Td className="font-mono">{r.employee?.employeeCode ?? '—'}</Td>
              <Td>{r.employee?.department?.name ?? '—'}</Td>
              <Td>{formatDate(r.date)}</Td>
              <Td>{formatTime(r.checkIn)}</Td>
              <Td>{formatTime(r.checkOut)}</Td>
              <Td>
                <StatusBadge status={ATTENDANCE_STATUS_LABEL[r.status] ?? r.status} />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {!isLoading && rows.length === 0 && (
        <EmptyState title="No attendance records" subtitle="No punches recorded for this period yet." />
      )}

      {rows.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-[11px] text-text-muted print:mt-2 print:pt-1.5">
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
 * Workbench "Personnel > Attendance" screen -- pick a date (and optionally
 * a department), then Print. The real, daily-used Attendance page lives at
 * app/attendance/page.tsx (linked from the Sidebar) and has its own
 * print button reusing AttendanceReportPrintable above instead of this
 * toolbar; this one is this module's own self-contained version of the
 * same report.
 */
export function AttendanceReport() {
  const [date, setDate] = useState(todayISO());
  const [departmentId, setDepartmentId] = useState('');

  const { data: departments } = useDepartments();
  const { data: company } = useCompany();
  const { data, isLoading } = useAttendance({
    startDate: date,
    endDate: date,
    departmentId: departmentId || undefined,
    page: 1,
    pageSize: 1000,
  });

  const rows = data?.items ?? [];
  const departmentName = departments?.find((d) => d.id === departmentId)?.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <FieldWrap label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Department">
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All Departments</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
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
              periodLabel: formatDate(date),
              scopeLabel: departmentName,
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
            periodLabel={formatDate(date)}
            scopeLabel={departmentName}
            isLoading={isLoading}
          />
        </div>
      </Card>
    </div>
  );
}
