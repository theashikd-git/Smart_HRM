'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { useCreateMyLeaveRequest, useMyLeaveBalances } from '@/hooks/useLeave';
import { useLeaveTypes } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';

/** The employee-portal equivalent of NewLeaveRequestModal -- same shape,
 *  but always applies for the signed-in employee's own record (no employee
 *  picker, no HR-only balance override) via the /leave/my/requests route. */
export function MyLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: leaveTypes } = useLeaveTypes();
  const { data: balances } = useMyLeaveBalances();
  const createRequest = useCreateMyLeaveRequest();

  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [session, setSession] = useState<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL_DAY');
  const [reason, setReason] = useState('');

  const selectedBalance = balances?.find((b) => b.leaveTypeId === leaveTypeId);

  useEffect(() => {
    if (session !== 'FULL_DAY' && startDate) setEndDate(startDate);
  }, [session, startDate]);

  useEffect(() => {
    if (!open) {
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setSession('FULL_DAY');
      setReason('');
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !startDate || !endDate) {
      toast.error('Fill in leave type and dates');
      return;
    }
    try {
      await createRequest.mutateAsync({
        leaveTypeId,
        startDate,
        endDate,
        session,
        reason: reason || undefined,
      });
      toast.success('Leave request submitted');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Your request will be sent to your approval chain"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="my-leave-form" loading={createRequest.isPending}>
            Submit Request
          </Button>
        </>
      }
    >
      <form id="my-leave-form" onSubmit={handleSubmit} className="space-y-4">
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
      </form>
    </Modal>
  );
}
