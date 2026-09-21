'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Textarea } from '@/components/ui/Form';
import { useRejectLeaveRequest, useRejectCancellation } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import { LeaveRequest } from '@/types';

/**
 * Shared reject dialog for both leave-decision chains: the original
 * approval chain (mode="approval", the default) and the cancellation chain
 * a request walks after it's already been approved (mode="cancellation").
 * Same form either way -- only which mutation it fires and its copy
 * differ. See useRejectLeaveRequest / useRejectCancellation.
 */
export function RejectLeaveModal({
  request,
  onClose,
  mode = 'approval',
}: {
  request: LeaveRequest | null;
  onClose: () => void;
  mode?: 'approval' | 'cancellation';
}) {
  const [reason, setReason] = useState('');
  const rejectRequest = useRejectLeaveRequest();
  const rejectCancellation = useRejectCancellation();
  const pending = mode === 'cancellation' ? rejectCancellation.isPending : rejectRequest.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    if (!reason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    try {
      if (mode === 'cancellation') {
        await rejectCancellation.mutateAsync({ id: request.id, reason });
        toast.success('Cancellation rejected -- the leave remains approved');
      } else {
        await rejectRequest.mutateAsync({ id: request.id, reason });
        toast.success('Leave request rejected');
      }
      setReason('');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title={mode === 'cancellation' ? 'Reject Cancellation Request' : 'Reject Leave Request'}
      subtitle={request ? `${request.employee?.fullName} — ${request.leaveType?.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" form="reject-leave-form" loading={pending}>
            {mode === 'cancellation' ? 'Reject Cancellation' : 'Reject Request'}
          </Button>
        </>
      }
    >
      <form id="reject-leave-form" onSubmit={handleSubmit}>
        <FieldWrap label="Reason" required>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === 'cancellation'
                ? 'Why is this cancellation request being rejected?'
                : 'Why is this request being rejected?'
            }
            autoFocus
          />
        </FieldWrap>
      </form>
    </Modal>
  );
}
