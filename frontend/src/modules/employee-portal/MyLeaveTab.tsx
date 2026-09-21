'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, CheckCircle2, XCircle, Ban, PlusCircle, Clock3 } from 'lucide-react';
import { Card, CardHeader, StatusPill, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useMyLeaveRequests, useMyLeaveBalances, useCancelMyLeaveRequest } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime, leaveStatusColors } from '@/lib/utils';
import { MyLeaveRequestModal } from './MyLeaveRequestModal';

/**
 * "My Leave" -- an employee's own leave: balances, Apply for Leave, and the
 * full history/status of every request they've made. Shared between
 * EmployeePortalView and ManagerPortalView (a Manager sees this alongside
 * "Leave Request" below) so both logins get an identical self-service leave
 * screen. Fully self-contained -- owns its own Apply for Leave modal, same
 * as the Dashboard tab's My Calendar card owns its own instance; the two
 * never show at once since only one tab is active at a time.
 */
export function MyLeaveTab() {
  const { data: requests, isLoading: requestsLoading } = useMyLeaveRequests();
  const { data: balances } = useMyLeaveBalances();
  const cancelRequest = useCancelMyLeaveRequest();
  const [requestOpen, setRequestOpen] = useState(false);

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
    <>
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

      <MyLeaveRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </>
  );
}
