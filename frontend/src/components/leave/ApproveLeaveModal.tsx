'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Textarea } from '@/components/ui/Form';
import { useApproveLeaveRequest } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import { LeaveRequest } from '@/types';

/**
 * Approve dialog for the original leave-approval chain. Mirrors
 * RejectLeaveModal's shape, but the note here is always optional -- unlike
 * a rejection, an approver isn't required to explain an approval. See
 * useApproveLeaveRequest / LeaveService.approve.
 */
export function ApproveLeaveModal({ request, onClose }: { request: LeaveRequest | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  const approveRequest = useApproveLeaveRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    try {
      await approveRequest.mutateAsync({ id: request.id, note: note.trim() || undefined });
      toast.success('Leave request approved');
      setNote('');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title="Approve Leave Request"
      subtitle={request ? `${request.employee?.fullName} · ${request.leaveType?.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="approve-leave-form" loading={approveRequest.isPending}>
            Approve Request
          </Button>
        </>
      }
    >
      <form id="approve-leave-form" onSubmit={handleSubmit}>
        <FieldWrap label="Note (optional)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for this approval, if you'd like"
            autoFocus
          />
        </FieldWrap>
      </form>
    </Modal>
  );
}
