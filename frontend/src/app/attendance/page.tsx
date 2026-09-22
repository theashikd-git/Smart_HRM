'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, CalendarCheck, PenSquare, CheckCircle2, PlusCircle, AlertTriangle, Download, Printer } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { StatusPill } from '@/components/ui/Card';
import { ManualPunchModal } from '@/components/attendance/ManualPunchModal';
import { CorrectionModal } from '@/components/attendance/CorrectionModal';
import { useAttendance, useSyncAttendance, useApproveAttendance, useMissingPunches } from '@/hooks/useAttendance';
import { useDepartments } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { useCompany } from '@/hooks/useCompany';
import { downloadAttendanceReportPdf, printAttendanceReportPdf } from '@/lib/attendance-report-pdf';
import { apiErrorMessage } from '@/lib/api';
import { attendanceStatusColors, formatDate, formatTime, minutesToHm } from '@/lib/utils';
import { AttendanceRecord } from '@/types';

export default function AttendancePage() {
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(1);
  const [manualOpen, setManualOpen] = useState(false);
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);

  const { data, isLoading } = useAttendance({
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    departmentId: departmentId || undefined,
    employeeId: employeeId || undefined,
    page,
    pageSize: 15,
  });
  const { data: missing } = useMissingPunches();
  const syncAttendance = useSyncAttendance();
  const approveAttendance = useApproveAttendance();
  const { data: company } = useCompany();
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees({ departmentId: departmentId || undefined, pageSize: 500 });
  // Full-dataset query for the printable report below -- ignores the
  // management table's `page`, since a printed report should list
  // everything the current filters match, not just the on-screen
  // 15-per-page slice.
  const { data: printData } = useAttendance({
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    departmentId: departmentId || undefined,
    employeeId: employeeId || undefined,
    page: 1,
    pageSize: 2000,
  });

  function periodLabel() {
    if (startDate && endDate) return startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`;
    if (startDate) return `From ${formatDate(startDate)}`;
    if (endDate) return `Through ${formatDate(endDate)}`;
    return 'All Dates';
  }

  // The department this run was filtered to -- always shown on the
  // report, so "All Departments" is spelled out rather than left blank.
  function departmentLabel() {
    return departments?.find((d) => d.id === departmentId)?.name ?? 'All Departments';
  }

  function scopeLabel() {
    const parts: string[] = [];
    const selectedEmployee = employees?.items.find((e) => e.id === employeeId);
    if (selectedEmployee) parts.push(`Employee: ${selectedEmployee.fullName} (${selectedEmployee.employeeCode})`);
    if (status) parts.push(`Status: ${status.replace('_', ' ')}`);
    return parts.length ? parts.join('   |   ') : undefined;
  }

  async function handleSync() {
    try {
      const res = await syncAttendance.mutateAsync();
      toast.success(`Pulled ${res.pulled} punches from device, ${res.created} new`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleApprove(record: AttendanceRecord) {
    try {
      await approveAttendance.mutateAsync({ id: record.id, approved: !record.approved });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Attendance" subtitle="Fingerprint, face, RFID, and manual punches, all in one place">
      {missing && missing.length > 0 && (
        <Card className="mb-4 border-warning/30 bg-warning-soft/40 p-4 flex items-start gap-3 print:hidden">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-sm text-text-primary">
            <span className="font-medium">{missing.length} missing punch{missing.length > 1 ? 'es' : ''}</span>{' '}
            detected — employees with a check-in but no check-out. Use “Correct” below to resolve them.
          </p>
        </Card>
      )}

      <Card className="print:hidden">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 p-5 border-b border-line items-center">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-40">
            <option value="">All Status</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="HOLIDAY">Holiday</option>
          </Select>
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="sm:w-40" />
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="sm:w-40" />
          <Select
            value={departmentId}
            onChange={(e) => { setDepartmentId(e.target.value); setEmployeeId(''); setPage(1); }}
            className="sm:w-44"
          >
            <option value="">All Departments</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            value={employeeId}
            onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}
            className="sm:w-48"
          >
            <option value="">All Employees</option>
            {employees?.items.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.employeeCode})
              </option>
            ))}
          </Select>

          <div className="flex-1" />

          <Button variant="outline" onClick={() => setManualOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Manual Punch
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              printAttendanceReportPdf({
                company,
                rows: printData?.items ?? [],
                periodLabel: periodLabel(),
                departmentLabel: departmentLabel(),
                scopeLabel: scopeLabel(),
              })
            }
            disabled={!printData?.items.length}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadAttendanceReportPdf({
                company,
                rows: printData?.items ?? [],
                periodLabel: periodLabel(),
                departmentLabel: departmentLabel(),
                scopeLabel: scopeLabel(),
              })
            }
            disabled={!printData?.items.length}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button onClick={handleSync} loading={syncAttendance.isPending}>
            <RefreshCw className="h-4 w-4" />
            Sync from Device
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Date</Th>
              <Th>Check In</Th>
              <Th>Check Out</Th>
              <Th>Work Hours</Th>
              <Th>Late</Th>
              <Th>Overtime</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.items.map((record) => (
              <Tr key={record.id}>
                <Td>
                  <p className="font-medium">{record.employee?.fullName}</p>
                  <p className="text-xs text-text-muted font-mono">{record.employee?.employeeCode}</p>
                </Td>
                <Td>{formatDate(record.date)}</Td>
                <Td className="font-mono text-xs">{formatTime(record.checkIn)}</Td>
                <Td className="font-mono text-xs">
                  {record.checkOut ? (
                    formatTime(record.checkOut)
                  ) : (
                    <span className="text-warning">Missing</span>
                  )}
                </Td>
                <Td>{record.workHours ? `${record.workHours}h` : '—'}</Td>
                <Td>{record.lateMinutes > 0 ? minutesToHm(record.lateMinutes) : '—'}</Td>
                <Td>{record.overtimeMinutes > 0 ? minutesToHm(record.overtimeMinutes) : '—'}</Td>
                <Td>
                  <StatusPill label={record.status.replace('_', ' ')} colors={attendanceStatusColors[record.status]} />
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setCorrectionRecord(record)}
                      title="Correct"
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <PenSquare className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleApprove(record)}
                      title={record.approved ? 'Approved' : 'Approve'}
                      className={
                        record.approved
                          ? 'rounded-md p-1.5 text-success bg-success-soft'
                          : 'rounded-md p-1.5 text-text-muted hover:bg-success-soft hover:text-success'
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <EmptyState
            icon={<CalendarCheck className="h-8 w-8" />}
            title="No attendance records found"
            subtitle="Sync from the device or add a manual punch to get started."
          />
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-line">
            <p className="text-xs text-text-secondary">
              Page {data.page} of {data.totalPages} &middot; {data.total} records
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>


      <ManualPunchModal open={manualOpen} onClose={() => setManualOpen(false)} />
      <CorrectionModal open={!!correctionRecord} onClose={() => setCorrectionRecord(null)} record={correctionRecord} />
    </AppShell>
  );
}
