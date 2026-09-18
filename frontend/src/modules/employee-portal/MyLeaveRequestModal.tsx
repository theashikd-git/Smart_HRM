'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { useCreateMyLeaveRequest, useMyLeaveBalances, useUploadLeaveAttachment } from '@/hooks/useLeave';
import { useMyEligibleLeaveTypes } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';

/** The employee-portal equivalent of NewLeaveRequestModal -- same shape,
 *  but always applies for the signed-in employee's own record (no employee
 *  picker, no HR-only balance override) via the /leave/my/requests route.
 *  The leave-type dropdown is scoped to what useMyEligibleLeaveTypes returns
 *  -- only the leaves configured for this employee's own employee category
 *  (Permanent/Provision/etc, set on their profile), plus special-rule types
 *  (Compensatory/Maternity) that apply regardless of category -- instead of
 *  every active leave type in the system. */
export function MyLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: leaveTypes } = useMyEligibleLeaveTypes();
  const { data: balances } = useMyLeaveBalances();
  const createRequest = useCreateMyLeaveRequest();

  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [session, setSession] = useState<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL_DAY');
  const [reason, setReason] = useState('');
  const [compensatoryForDate, setCompensatoryForDate] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const uploadAttachment = useUploadLeaveAttachment();

  const selectedBalance = balances?.find((b) => b.leaveTypeId === leaveTypeId);
  const selectedLeaveType = leaveTypes?.find((t) => t.id === leaveTypeId);
  const isCompensatory = selectedLeaveType?.specialRule === 'COMPENSATORY';
  const isMaternity = selectedLeaveType?.specialRule === 'MATERNITY';

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
      setCompensatoryForDate('');
      setAttachmentFile(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !startDate || !endDate) {
      toast.error('Fill in leave type and dates');
      return;
    }
    if (isCompensatory && !compensatoryForDate) {
      toast.error('Select the past duty date this compensatory day is being claimed against');
      return;
    }
    if (isMaternity && !attachmentFile) {
      toast.error('A supporting document is required for Maternity Leave');
      return;
    }
    try {
      let attachmentId: string | undefined;
      if (isMaternity && attachmentFile) {
        const uploaded = await uploadAttachment.mutateAsync({ file: attachmentFile });
        attachmentId = uploaded.id;
      }
      await createRequest.mutateAsync({
        leaveTypeId,
        startDate,
        endDate,
        session,
        reason: reason || undefined,
        compensatoryForDate: isCompensatory ? compensatoryForDate : undefined,
        attachmentId,
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
          <Button type="submit" form="my-leave-form" loading={createRequest.isPending || uploadAttachment.isPending}>
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

        {isCompensatory && (
          <FieldWrap
            label="Duty Date Being Claimed"
            required
            hint="The past date this compensatory day off is being claimed against"
          >
            <Input type="date" value={compensatoryForDate} onChange={(e) => setCompensatoryForDate(e.target.value)} required />
          </FieldWrap>
        )}

        {isMaternity && (
          <FieldWrap label="Supporting Document" required hint="Required to apply for Maternity Leave">
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs"
            />
          </FieldWrap>
        )}

        <FieldWrap label="Reason" hint="Optional">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave" />
        </FieldWrap>
      </form>
    </Modal>
  );
}
