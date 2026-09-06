'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, CalendarDays, PlusCircle, Ban, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardHeader, StatusPill, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { UserMenu } from '@/components/shell/UserMenu';
import { useMyLeaveRequests, useMyLeaveBalances, useCancelMyLeaveRequest } from '@/hooks/useLeave';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { apiErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime, leaveStatusColors } from '@/lib/utils';
import { MyLeaveRequestModal } from './MyLeaveRequestModal';
import { ChangePasswordGate } from './ChangePasswordGate';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Self-service home for an EMPLOYEE-role login (see /login's "Employee
 * Login" mode). Deliberately its own small shell -- not the Workbench --
 * since an employee should only ever see their own balances, requests, and
 * a way to apply/cancel; useRequireAuth('employee') keeps staff logins out
 * of this route and bounces an EMPLOYEE login away from /workbench.
 */
export function EmployeePortalView() {
  const { ready } = useRequireAuth('employee');
  const user = useAuthStore((s) => s.user);
  const [requestOpen, setRequestOpen] = useState(false);

  const { data: requests, isLoading: requestsLoading } = useMyLeaveRequests();
  const { data: balances } = useMyLeaveBalances();
  const cancelRequest = useCancelMyLeaveRequest();

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  // A freshly auto-provisioned account (default password = Employee ID)
  // must change it before seeing anything else -- see ChangePasswordGate.
  if (user?.mustChangePassword) {
    return <ChangePasswordGate />;
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await cancelRequest.mutateAsync(id);
      toast.success('Leave request cancelled');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-ink-line/40 bg-ink px-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Smart HRM</span>
          <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/60">
            Employee Portal
          </span>
        </div>
        <UserMenu />
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-text-primary">My Leave</h1>
            <p className="text-xs text-text-secondary">Your balances, requests, and approval status</p>
          </div>
          <Button onClick={() => setRequestOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Apply for Leave
          </Button>
        </div>

        <Card className="mb-4">
          <CardHeader title="Leave Balances" subtitle="Remaining days for the current year" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-5 pb-5">
            {balances?.map((b) => (
              <div key={b.leaveTypeId} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color ?? '#94a3b8' }} />
                  <p className="text-xs font-medium text-text-secondary truncate">{b.leaveTypeName}</p>
                </div>
                <p className="text-lg font-semibold text-text-primary">{b.remaining}</p>
                <p className="text-[11px] text-text-muted">of {b.allocated + b.carriedForward} day(s)</p>
              </div>
            ))}
            {(!balances || balances.length === 0) && (
              <p className="col-span-full text-xs text-text-muted">No balances set up yet -- check with HR.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="My Requests" subtitle="History and current status of every request you've made" />
          <Table>
            <Thead>
              <tr>
                <Th>Leave Type</Th>
                <Th>Dates</Th>
                <Th>Days</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {requests?.map((request) => (
                <Tr key={request.id}>
                  <Td>
                    <Badge>{request.leaveType?.name}</Badge>
                    {!request.leaveType?.paid && <span className="ml-1.5 text-xs text-text-muted">Unpaid</span>}
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
                        <Clock3 className="h-3 w-3" /> Awaiting: {request.currentTierLabel}
                      </p>
                    )}
                    {request.status === 'REJECTED' && request.rejectionReason && (
                      <p className="mt-1 text-xs text-text-muted">Reason: {request.rejectionReason}</p>
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
                  <Td className="text-right">
                    {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        title="Cancel"
                        className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {!requestsLoading && (requests?.length ?? 0) === 0 && (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title="No leave requests yet"
              subtitle="Apply for leave to see it show up here."
            />
          )}
        </Card>
      </main>

      <MyLeaveRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
