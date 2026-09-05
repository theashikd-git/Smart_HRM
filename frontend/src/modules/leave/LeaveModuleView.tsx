'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, CheckCircle2, XCircle, Ban, PlusCircle, Clock } from 'lucide-react';
import { Card, CardHeader, StatusPill, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { NewLeaveRequestModal } from '@/components/leave/NewLeaveRequestModal';
import { RejectLeaveModal } from '@/components/leave/RejectLeaveModal';
import {
  useLeaveRequests,
  useLeaveTypes,
  useLeaveBalances,
  useLeavePendingCount,
  useApproveLeaveRequest,
  useCancelLeaveRequest,
} from '@/hooks/useLeave';
import { useEmployees } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { apiErrorMessage } from '@/lib/api';
import { formatDate, leaveStatusColors } from '@/lib/utils';
import { LeaveRequest } from '@/types';

/**
 * Root view for the top-level "Leave" module (see TopNavigation's MODULES
 * list). Unlike Personnel's programs, Leave has no internal Workbench tabs
 * or sidebar of its own -- it's a single self-contained screen, structured
 * the same way PersonnelDashboard is (own header + content, no shared chrome
 * beyond TopNavigation).
 */
export function LeaveModuleView() {
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [page, setPage] = useState(1);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [balanceEmployeeId, setBalanceEmployeeId] = useState('');

  const { data, isLoading } = useLeaveRequests({
    status: status || undefined,
    departmentId: departmentId || undefined,
    leaveTypeId: leaveTypeId || undefined,
    page,
    pageSize: 15,
  });
  const { data: leaveTypes } = useLeaveTypes();
  const { data: departments } = useDepartments();
  const { data: pendingCount } = useLeavePendingCount();
  const { data: employees } = useEmployees({ pageSize: 200 });
  const { data: balances } = useLeaveBalances(balanceEmployeeId || undefined);

  const approveRequest = useApproveLeaveRequest();
  const cancelRequest = useCancelLeaveRequest();

  async function handleApprove(request: LeaveRequest) {
    try {
      await approveRequest.mutateAsync(request.id);
      toast.success('Leave request approved');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleCancel(request: LeaveRequest) {
    try {
      await cancelRequest.mutateAsync(request.id);
      toast.success('Leave request cancelled');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="h-full overflow-auto bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text-primary">Leave</h1>
          <p className="text-xs text-text-secondary">Requests, approvals, and balances for every employee</p>
        </div>
        <Button onClick={() => setNewRequestOpen(true)}>
          <PlusCircle className="h-4 w-4" />
          New Request
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-soft text-warning">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-text-primary">{pendingCount ?? 0}</p>
              <p className="text-xs text-text-secondary">Requests awaiting a decision</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-text-secondary mb-2">Check an employee&apos;s balance</p>
          <Select value={balanceEmployeeId} onChange={(e) => setBalanceEmployeeId(e.target.value)}>
            <option value="">Select employee</option>
            {employees?.items.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.employeeCode})
              </option>
            ))}
          </Select>
          {balances && balances.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {balances.map((b) => (
                <div key={b.leaveTypeId} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{b.leaveTypeName}</span>
                  <Badge>{b.remaining} / {b.allocated + b.carriedForward} days</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 p-5 border-b border-line items-center">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-40">
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select
            value={departmentId}
            onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
            className="sm:w-44"
          >
            <option value="">All Departments</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Select
            value={leaveTypeId}
            onChange={(e) => { setLeaveTypeId(e.target.value); setPage(1); }}
            className="sm:w-44"
          >
            <option value="">All Leave Types</option>
            {leaveTypes?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Leave Type</Th>
              <Th>Dates</Th>
              <Th>Days</Th>
              <Th>Status</Th>
              <Th>Applied By</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.items.map((request) => (
              <Tr key={request.id}>
                <Td>
                  <p className="font-medium">{request.employee?.fullName}</p>
                  <p className="text-xs text-text-muted font-mono">{request.employee?.employeeCode}</p>
                </Td>
                <Td>
                  <Badge>{request.leaveType?.name}</Badge>
                  {!request.leaveType?.paid && (
                    <span className="ml-1.5 text-xs text-text-muted">Unpaid</span>
                  )}
                </Td>
                <Td className="text-xs">
                  {formatDate(request.startDate)}
                  {request.startDate !== request.endDate && <> — {formatDate(request.endDate)}</>}
                  {request.session !== 'FULL_DAY' && (
                    <span className="block text-text-muted">
                      {request.session === 'FIRST_HALF' ? 'First half' : 'Second half'}
                    </span>
                  )}
                </Td>
                <Td>{request.totalDays}</Td>
                <Td>
                  <StatusPill label={request.status} colors={leaveStatusColors[request.status]} />
                  {request.status === 'REJECTED' && request.rejectionReason && (
                    <p className="text-xs text-text-muted mt-1 max-w-[160px]">{request.rejectionReason}</p>
                  )}
                </Td>
                <Td className="text-xs text-text-secondary">{request.appliedBy?.fullName ?? '—'}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {request.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(request)}
                          title="Approve"
                          className="rounded-md p-1.5 text-text-muted hover:bg-success-soft hover:text-success"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setRejectTarget(request)}
                          title="Reject"
                          className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                      <button
                        onClick={() => handleCancel(request)}
                        title="Cancel"
                        className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="No leave requests found"
            subtitle="Log a new request to get started."
          />
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-line">
            <p className="text-xs text-text-secondary">
              Page {data.page} of {data.totalPages} &middot; {data.total} requests
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

      <NewLeaveRequestModal open={newRequestOpen} onClose={() => setNewRequestOpen(false)} />
      <RejectLeaveModal request={rejectTarget} onClose={() => setRejectTarget(null)} />
    </div>
  );
}
