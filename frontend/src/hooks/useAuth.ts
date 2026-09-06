import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Self-service password change -- required on the employee portal until
 *  mustChangePassword clears, but usable by any signed-in role. */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) =>
      (await api.patch('/auth/change-password', payload)).data,
  });
}
