import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SystemUser } from '@/types';

/** Login accounts: ADMIN/HR/MANAGER staff, and EMPLOYEE self-service accounts
 *  linked to an Employee record. ADMIN-only on the backend. */
export function useUsers() {
  return useQuery({
    queryKey: ['system-users'],
    queryFn: async () => (await api.get<SystemUser[]>('/users')).data,
  });
}

export interface CreateUserPayload {
  role: 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  // Required for ADMIN/HR/MANAGER; omitted for EMPLOYEE (derived server-side
  // from the linked Employee record).
  email?: string;
  fullName?: string;
  password?: string;
  // Required for EMPLOYEE; optional link for other roles.
  employeeId?: string;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => (await api.post<SystemUser>('/users', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; fullName?: string; role?: string; isActive?: boolean; password?: string }) =>
      (await api.patch<SystemUser>(`/users/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-users'] }),
  });
}
