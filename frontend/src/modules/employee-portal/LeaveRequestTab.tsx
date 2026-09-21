'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { Card, StatusPill, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { RejectLeaveModal } from '@/components/leave/RejectLeaveModal';
import { useMyApprovals, useApproveLeaveRequest, useApproveCancellation } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime, leaveStatusColors } from '@/lib/utils';
import { LeaveRequest } from '@/types';

interface RejectTarget {
  request: LeaveRequest;
  mode: 'approval' | 'cancellation';
}

/**
 * "Leave Request" -- for a login named somewhere in a leave approval
 * workflow (a SPECIFIC_USER tier, or one that resolves as a department's
 * REPORTING_SUPERIOR/Manager, or -- for a cancellation's final tier -- any
 * ADMIN/HR login): every request they can act on right now, on either
 * chain, plus the full record of what they've decided before. Shared
 * between EmployeePortalView and ManagerPortalView -- callers gate whether
 * this tab even appears on useMyApprovals()'s result being non-empty, so a
 * login never named an approver never sees an empty tab for it. See
 * LeaveController.findMyApprovals / LeaveService.findMyApprovals for what
 * decides "mine to decide" (row.canDecide for the original approval chain,
 * row.canDecideCancellation for the cancellation chain) vs. "my past
 * decision" (row present only because of its decisions[]/
 * cancellationDecisions[] entries).
 */
export function LeaveRequestTab() {
  const { data: requests, isLoading } = useMyApprovals();
  const approveRequest = useApproveLeaveRequest();
  const approveCancellation = useApproveCancellation();
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);

  async function handleApprove(id: string) {
    try {
      await approveRequest.mutateAsync(id);
      toast.success('Leave request approved');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleApproveCancellation(id: string) {
    try {
      await approveCancellation.mutateAsync(id);
      toast.success('Cancellation approved');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-[15px] font-semibold text-text-primary">Leave Request</h1>
        <p className="text-xs text-text-secondary">Requests you can act on, and your approval/rejection history</p>
      </div>

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
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
                  <p className="font-medium">{request.employee?.fullName}</p>
                  <p className="text-xs text-text-muted font-mono">{request.employee?.employeeCode}</p>
                </Td>
                <Td>
                  <Badge>{request.leaveType?.name}</Badge>
                </Td>
                <Td className="text-xs">
                  {formatDate(request.startDate)}
                  {request.startDate !== request.endDate && <> — {formatDate(request.endDate)}</>}
                </Td>
                <Td>{request.totalDays}</Td>
                <Td className="max-w-[260px]">
                  <StatusPill label={request.status} colors={leaveStatusColors[request.status]} />
                  {request.status === 'PENDING' && request.currentTierLabel && (
                    <p className="mt-1 text-xs text-text-muted">Awaiting: {request.currentTierLabel}</p>
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
                  {request.cancellationStatus === 'PENDING' && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-warning">
                      <Clock3 className="h-3 w-3" /> Cancellation awaiting: {request.cancellationCurrentTierLabel ?? '—'}
                    </p>
                  )}
                  {request.cancellationStatus === 'REJECTED' && (
                    <p className="mt-1.5 text-xs text-text-muted">Cancellation request was rejected -- leave remains approved.</p>
                  )}
                  {request.cancellationDecisions && request.cancellationDecisions.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 border-l-2 border-warning/50 pl-2">
                      {request.cancellationDecisions.map((d) => (
                        <p key={d.id} className="text-[11px] text-text-muted">
                          Cancel:{' '}
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
                  {request.status === 'PENDING' && request.canDecide && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setRejectTarget({ request, mode: 'approval' })}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(request.id)} loading={approveRequest.isPending}>
                        Approve
                      </Button>
                    </div>
                  )}
                  {request.cancellationStatus === 'PENDING' && request.canDecideCancellation && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setRejectTarget({ request, mode: 'cancellation' })}>
                        Reject Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleApproveCancellation(request.id)} loading={approveCancellation.isPending}>
                        Approve Cancel
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (requests?.length ?? 0) === 0 && (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            title="Nothing here yet"
            subtitle="Requests assigned to you for approval, and your decisions, will show up here."
          />
        )}
      </Card>

      <RejectLeaveModal
        request={rejectTarget?.request ?? null}
        mode={rejectTarget?.mode}
        onClose={() => setRejectTarget(null)}
      />
    </>
  );
}
