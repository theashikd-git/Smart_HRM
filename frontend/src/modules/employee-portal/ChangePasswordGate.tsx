'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input } from '@/components/ui/Form';
import { useChangePassword } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/auth-store';
import { apiErrorMessage } from '@/lib/api';

/**
 * Blocks the employee portal until a freshly auto-provisioned account (see
 * EmployeesService/UsersService.create) changes its default password (the
 * Employee ID) -- gated on user.mustChangePassword, which the backend clears
 * once /auth/change-password succeeds. EmployeePortalView renders this
 * instead of the normal portal content while the flag is still set.
 */
export function ChangePasswordGate() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const changePassword = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
      if (user) setUser({ ...user, mustChangePassword: false });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Set a new password</p>
            <p className="text-xs text-text-secondary">You're signed in with the default password -- change it to continue.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldWrap label="Current Password" required hint="Your Employee ID, if this is your first time signing in">
            <Input
              type="password"
              required
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

          <Button type="submit" className="w-full mt-2" size="lg" loading={changePassword.isPending}>
            <KeyRound className="h-4 w-4" />
            Change Password
          </Button>
        </form>
      </div>
    </div>
  );
}
