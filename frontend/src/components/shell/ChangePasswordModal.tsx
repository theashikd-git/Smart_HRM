'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input } from '@/components/ui/Form';
import { useChangePassword } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Voluntary "Change Password" popup -- opened from UserMenu (My Profile /
 * Sign Out), so it's available on every portal that renders UserMenu:
 * the staff Workbench (TopNavigation), the Employee Portal, and the
 * Manager Portal. Hits the same PATCH /auth/change-password endpoint as
 * the forced first-login flow (see ChangePasswordGate), just without the
 * full-screen lockout -- this is for someone changing their password by
 * choice, not because mustChangePassword is set.
 */
export function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const changePassword = useChangePassword();

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast.success('Password changed');
      handleClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Change Password" size="sm">
      <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
        <FieldWrap label="Current Password" required>
          <Input
            type="password"
            required
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </FieldWrap>
        <FieldWrap label="New Password" required hint="At least 6 characters">
          <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Confirm New Password" required>
          <Input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FieldWrap>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={changePassword.isPending}>
            Change Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
