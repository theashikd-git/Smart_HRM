'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Textarea } from '@/components/ui/Form';
import { useCancelLeaveRequest } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import { LeaveRequest } from '@/types';

/**
 * HR/Admin/Manager direct-cancel dialog (LeaveController.cancel /
 * LeaveService.cancel) -- an immediate, one-step override available any
 * time a request is PENDING, APPROVED, or already REJECTED, bypassing the
 * employee's own requestCancellation()/approveCancellation() chain
 * entirely. A reason is required only when the request being cancelled is
 * currently APPROVED (it was already granted, so reversing it needs an
 * explanation); for a PENDING or REJECTED request it's accepted but
 * optional, same shape as ApproveLeaveModal. The employee is always
 * notified either way -- see LeaveService.cancel.
 */
export function CancelLeaveModal({ request, onClose }: { request: LeaveRequest | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const cancelRequest = useCancelLeaveRequest();
  const reasonRequired = request?.status === 'APPROVED';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    if (reasonRequired && !reason.trim()) {
      toast.error('A reason is required to cancel an already-approved leave request');
      return;
    }
    try {
      await cancelRequest.mutateAsync({ id: request.id, reason: reason.trim() || undefined });
      toast.success('Leave request cancelled');
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
      title="Cancel Leave Request"
      subtitle={request ? `${request.employee?.fullName} · ${request.leaveType?.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant="danger" type="submit" form="cancel-leave-form" loading={cancelRequest.isPending}>
            Cancel Request
          </Button>
        </>
      }
    >
      <form id="cancel-leave-form" onSubmit={handleSubmit}>
        <FieldWrap label="Reason" required={reasonRequired}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              reasonRequired
                ? 'Why is this already-approved leave being cancelled?'
                : 'Add a reason, if you want to (optional)'
            }
            autoFocus
          />
        </FieldWrap>
      </form>
    </Modal>
  );
}
