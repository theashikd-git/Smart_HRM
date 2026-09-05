'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { useCreateLeaveRequest, useLeaveBalances, useLeaveTypes } from '@/hooks/useLeave';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function NewLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const canOverride = user?.role === 'ADMIN' || user?.role === 'HR';

  const { data: employees } = useEmployees({ pageSize: 200 });
  const { data: leaveTypes } = useLeaveTypes();
  const createRequest = useCreateLeaveRequest();

  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [session, setSession] = useState<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL_DAY');
  const [reason, setReason] = useState('');
  const [overrideBalance, setOverrideBalance] = useState(false);

  const { data: balances } = useLeaveBalances(employeeId || undefined);
  const selectedBalance = balances?.find((b) => b.leaveTypeId === leaveTypeId);

  useEffect(() => {
    if (session !== 'FULL_DAY' && startDate) setEndDate(startDate);
  }, [session, startDate]);

  useEffect(() => {
    if (!open) {
      setEmployeeId('');
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setSession('FULL_DAY');
      setReason('');
      setOverrideBalance(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      toast.error('Fill in employee, leave type, and dates');
      return;
    }
    try {
      await createRequest.mutateAsync({
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        session,
        reason: reason || undefined,
        overrideBalance: canOverride ? overrideBalance : undefined,
      });
      toast.success('Leave request logged');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Leave Request"
      subtitle="Log a leave request on behalf of an employee"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-leave-form" loading={createRequest.isPending}>
            Submit Request
          </Button>
        </>
      }
    >
      <form id="new-leave-form" onSubmit={handleSubmit} className="space-y-4">
        <FieldWrap label="Employee" required>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Select employee</option>
            {employees?.items.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.employeeCode})
              </option>
            ))}
          </Select>
        </FieldWrap>

        <FieldWrap label="Leave Type" required>
          <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required>
            <option value="">Select leave type</option>
            {leaveTypes?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} {!type.paid && '(Unpaid)'}
              </option>
            ))}
          </Select>
          {selectedBalance && (
            <p className="text-xs text-text-muted mt-1">
              {selectedBalance.remaining} day(s) remaining for {selectedBalance.year}
            </p>
          )}
        </FieldWrap>

        <div className="grid grid-cols-2 gap-3">
          <FieldWrap label="Start Date" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </FieldWrap>
          <FieldWrap label="End Date" required>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={session !== 'FULL_DAY'}
              required
            />
          </FieldWrap>
        </div>

        <FieldWrap label="Session">
          <Select value={session} onChange={(e) => setSession(e.target.value as any)}>
            <option value="FULL_DAY">Full Day</option>
            <option value="FIRST_HALF">First Half</option>
            <option value="SECOND_HALF">Second Half</option>
          </Select>
        </FieldWrap>

        <FieldWrap label="Reason" hint="Optional">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave" />
        </FieldWrap>

        {canOverride && (
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={overrideBalance}
              onChange={(e) => setOverrideBalance(e.target.checked)}
              className="rounded border-line"
            />
            Approve even if this exceeds the employee&apos;s remaining balance
          </label>
        )}
      </form>
    </Modal>
  );
}
