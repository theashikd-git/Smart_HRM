'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, CheckCircle2, XCircle, Ban, PlusCircle, Clock, Trash2, Settings2 } from 'lucide-react';
import { Card, CardHeader, StatusPill, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
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
  useCreateLeaveType,
  useDeactivateLeaveType,
} from '@/hooks/useLeave';
import { useEmployees } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuthStore } from '@/lib/auth-store';
import { apiErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime, leaveStatusColors } from '@/lib/utils';
import { LeaveRequest, LeaveType } from '@/types';

/**
 * Root view for the top-level "Leave" module (see TopNavigation's MODULES
 * list). Unlike Personnel's programs, Leave has no internal Workbench tabs
 * or sidebar of its own -- it's a single self-contained screen, structured
 * the same way PersonnelDashboard is (own header + content, no shared chrome
 * beyond TopNavigation). It does have its own small internal tab switch
 * (Requests / Leave Types), separate from the Workbench's tab system.
 */
export function LeaveModuleView() {
  const user = useAuthStore((s) => s.user);
  const canManageTypes = user?.role === 'ADMIN' || user?.role === 'HR';
  const [tab, setTab] = useState<'requests' | 'types'>('requests');

  return (
    <div className="h-full overflow-auto bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text-primary">Leave</h1>
          <p className="text-xs text-text-secondary">Requests, approvals, and balances for every employee</p>
        </div>

        {canManageTypes && (
          <div className="flex items-center rounded-lg border border-line bg-white p-0.5">
            <button
              onClick={() => setTab('requests')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'requests' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Requests
            </button>
            <button
              onClick={() => setTab('types')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'types' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Leave Types
            </button>
          </div>
        )}
      </div>

      {tab === 'types' && canManageTypes ? <LeaveTypesPanel /> : <LeaveRequestsPanel />}
    </div>
  );
}

function LeaveRequestsPanel() {
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
    <>
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

          <div className="flex-1" />

          <Button onClick={() => setNewRequestOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            New Request
          </Button>
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
                <Td className="max-w-[260px]">
                  <StatusPill label={request.status} colors={leaveStatusColors[request.status]} />
                  {request.status === 'PENDING' && request.currentTierLabel && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="h-3 w-3" /> Awaiting: {request.currentTierLabel}
                    </p>
                  )}
                  {request.status === 'REJECTED' && request.rejectionReason && (
                    <p className="text-xs text-text-muted mt-1">{request.rejectionReason}</p>
                  )}
                  {request.decisions && request.decisions.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 border-l-2 border-line pl-2">
                      {request.decisions.map((d) => (
                        <p key={d.id} className="text-[11px] text-text-muted">
                          {d.decision === 'APPROVED' ? (
                            <CheckCircle2 className="inline h-3 w-3 text-success mr-1" />
                          ) : (
                            <XCircle className="inline h-3 w-3 text-danger mr-1" />
                          )}
                          {d.tierLabel} &middot; {d.approver?.fullName ?? '—'} &middot; {formatDateTime(d.decidedAt)}
                          {d.reason && ` — ${d.reason}`}
                        </p>
                      ))}
                    </div>
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
    </>
  );
}

const EMPTY_TYPE_FORM = {
  name: '',
  code: '',
  daysPerYear: '',
  paid: true,
  carryForward: false,
  maxCarryForwardDays: '',
  requiresApproval: true,
  color: '#22c55e',
};

function LeaveTypesPanel() {
  const { data: leaveTypes, isLoading } = useLeaveTypes(true);
  const createType = useCreateLeaveType();
  const deactivateType = useDeactivateLeaveType();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_TYPE_FORM);

  const canSubmit = form.name.trim().length > 0 && form.code.trim().length > 0;

  async function handleCreate() {
    try {
      await createType.mutateAsync({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        daysPerYear: form.daysPerYear ? Number(form.daysPerYear) : 0,
        paid: form.paid,
        carryForward: form.carryForward,
        maxCarryForwardDays: form.carryForward && form.maxCarryForwardDays ? Number(form.maxCarryForwardDays) : undefined,
        requiresApproval: form.requiresApproval,
        color: form.color,
      });
      toast.success('Leave type created');
      setModalOpen(false);
      setForm(EMPTY_TYPE_FORM);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDeactivate(type: LeaveType) {
    if (!confirm(`Deactivate "${type.name}"? Existing balances and requests are kept, but it can no longer be used for new requests.`)) return;
    try {
      await deactivateType.mutateAsync(type.id);
      toast.success(`${type.name} deactivated`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader
        title="Leave Types"
        subtitle="Entitlements, carry-forward rules, and approval requirements for each leave type"
        action={
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_TYPE_FORM);
              setModalOpen(true);
            }}
          >
            <PlusCircle className="h-3.5 w-3.5" /> Add Leave Type
          </Button>
        }
      />

      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Code</Th>
            <Th>Days / Year</Th>
            <Th>Paid</Th>
            <Th>Carry Forward</Th>
            <Th>Approval</Th>
            <Th>Status</Th>
            <Th></Th>
          </tr>
        </Thead>
        <Tbody>
          {leaveTypes?.map((type) => (
            <Tr key={type.id}>
              <Td>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: type.color ?? '#94a3b8' }}
                  />
                  <span className="font-medium">{type.name}</span>
                </div>
              </Td>
              <Td className="font-mono text-xs">{type.code}</Td>
              <Td>{type.daysPerYear}</Td>
              <Td>{type.paid ? 'Paid' : 'Unpaid'}</Td>
              <Td>
                {type.carryForward
                  ? `Up to ${type.maxCarryForwardDays ?? '—'} day(s)`
                  : 'No'}
              </Td>
              <Td>{type.requiresApproval ? 'Required' : 'Auto-approved'}</Td>
              <Td>
                <Badge className={type.isActive ? undefined : 'text-text-muted'}>
                  {type.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </Td>
              <Td className="text-right">
                {type.isActive && (
                  <button
                    onClick={() => handleDeactivate(type)}
                    title="Deactivate"
                    className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {!isLoading && (leaveTypes?.length ?? 0) === 0 && (
        <EmptyState title="No leave types yet" subtitle="Add one to start accepting leave requests." />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Leave Type"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={createType.isPending} onClick={handleCreate} disabled={!canSubmit}>
              Create Leave Type
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrap label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Annual Leave" />
          </FieldWrap>
          <FieldWrap label="Code" required hint="Short unique code, e.g. ANNUAL">
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ANNUAL" />
          </FieldWrap>
          <FieldWrap label="Days per Year">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.daysPerYear}
              onChange={(e) => setForm((f) => ({ ...f, daysPerYear: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap label="Color">
            <Input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
          </FieldWrap>
          <FieldWrap label="Paid">
            <Select
              value={form.paid ? 'yes' : 'no'}
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value === 'yes' }))}
            >
              <option value="yes">Paid</option>
              <option value="no">Unpaid</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Requires Approval">
            <Select
              value={form.requiresApproval ? 'yes' : 'no'}
              onChange={(e) => setForm((f) => ({ ...f, requiresApproval: e.target.value === 'yes' }))}
            >
              <option value="yes">Requires approval</option>
              <option value="no">Auto-approved</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Carry Forward">
            <Select
              value={form.carryForward ? 'yes' : 'no'}
              onChange={(e) => setForm((f) => ({ ...f, carryForward: e.target.value === 'yes' }))}
            >
              <option value="no">Does not carry forward</option>
              <option value="yes">Carries forward</option>
            </Select>
          </FieldWrap>
          {form.carryForward && (
            <FieldWrap label="Max Carry-Forward Days">
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.maxCarryForwardDays}
                onChange={(e) => setForm((f) => ({ ...f, maxCarryForwardDays: e.target.value }))}
              />
            </FieldWrap>
          )}
        </div>
      </Modal>
    </Card>
  );
}
