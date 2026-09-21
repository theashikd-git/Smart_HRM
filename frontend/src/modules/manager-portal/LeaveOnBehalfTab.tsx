'use client';

import { useState } from 'react';
import { CalendarPlus, CalendarDays, Clock3 } from 'lucide-react';
import { Card, CardHeader, StatusPill, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { NewLeaveRequestModal } from '@/components/leave/NewLeaveRequestModal';
import { useMyTeamAttendance } from '@/hooks/useDashboard';
import { useAppliedOnBehalf } from '@/hooks/useLeave';
import { formatDate, leaveStatusColors } from '@/lib/utils';

/**
 * "Leave on Behalf" -- Manager Portal only. For a team member who can't
 * apply for their own leave (no login, unwell, unfamiliar with the system,
 * etc.), the department head files it for them here instead. Reuses the
 * same NewLeaveRequestModal the staff Leave module's "New Request" uses,
 * just with its employee picker scoped down to this manager's own team
 * (see useMyTeamAttendance) instead of the whole company. The table below
 * tracks only what THIS login has filed for someone else -- see
 * LeaveController.findAppliedOnBehalf -- so it stays a clear record of
 * "what did I file for my team", distinct from "Leave Request" (deciding
 * requests) and "My Leave" (this manager's own leave).
 */
export function LeaveOnBehalfTab() {
  const { data: team } = useMyTeamAttendance();
  const { data: requests, isLoading } = useAppliedOnBehalf();
  const [applyOpen, setApplyOpen] = useState(false);

  const employeeOptions = (team?.members ?? []).map((m) => ({
    id: m.id,
    fullName: m.fullName,
    employeeCode: m.employeeCode,
    gender: m.gender,
    joiningDate: m.joiningDate,
  }));

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text-primary">Leave on Behalf</h1>
          <p className="text-xs text-text-secondary">
            Apply for leave on behalf of a team member who can&apos;t apply for themselves
          </p>
        </div>
        <Button onClick={() => setApplyOpen(true)} disabled={employeeOptions.length === 0}>
          <CalendarPlus className="h-4 w-4" />
          Apply on Behalf
        </Button>
      </div>

      {team && !team.isManager && (
        <p className="mb-4 text-xs text-text-muted">You are not currently set as the head of any department.</p>
      )}
      {team?.isManager && employeeOptions.length === 0 && (
        <p className="mb-4 text-xs text-text-muted">No one is currently assigned to your department.</p>
      )}

      <Card>
        <CardHeader title="Requests You've Filed" subtitle="Leave you've applied for on behalf of a team member" />
        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Leave Type</Th>
              <Th>Dates</Th>
              <Th>Days</Th>
              <Th>Status</Th>
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
                  {!request.leaveType?.paid && <span className="ml-1.5 text-xs text-text-muted">Unpaid</span>}
                </Td>
                <Td className="text-xs">
                  {formatDate(request.startDate)}
                  {request.startDate !== request.endDate && <> — {formatDate(request.endDate)}</>}
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
                  {request.cancellationStatus === 'PENDING' && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-warning">
                      <Clock3 className="h-3 w-3" /> Cancellation awaiting: {request.cancellationCurrentTierLabel ?? '—'}
                    </p>
                  )}
                  {request.cancellationStatus === 'REJECTED' && (
                    <p className="mt-1.5 text-xs text-text-muted">Cancellation request was rejected -- leave remains approved.</p>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (requests?.length ?? 0) === 0 && (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="Nothing filed yet"
            subtitle="Leave you apply for on behalf of a team member will show up here."
          />
        )}
      </Card>

      <NewLeaveRequestModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        employees={employeeOptions}
        title="Apply Leave on Behalf"
        subtitle="Log a leave request for a team member who can't apply for themselves"
        hideSession
      />
    </>
  );
}
