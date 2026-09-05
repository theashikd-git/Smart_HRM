'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Textarea } from '@/components/ui/Form';
import { useRejectLeaveRequest } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import { LeaveRequest } from '@/types';

export function RejectLeaveModal({
  request,
  onClose,
}: {
  request: LeaveRequest | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const rejectRequest = useRejectLeaveRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    if (!reason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    try {
      await rejectRequest.mutateAsync({ id: request.id, reason });
      toast.success('Leave request rejected');
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
      title="Reject Leave Request"
      subtitle={request ? `${request.employee?.fullName} — ${request.leaveType?.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" form="reject-leave-form" loading={rejectRequest.isPending}>
            Reject Request
          </Button>
        </>
      }
    >
      <form id="reject-leave-form" onSubmit={handleSubmit}>
        <FieldWrap label="Reason" required>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this request being rejected?"
            autoFocus
          />
        </FieldWrap>
      </form>
    </Modal>
  );
}
