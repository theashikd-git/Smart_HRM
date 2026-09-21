import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SystemUser } from '@/types';

/** Login accounts: a traditional username/password ADMIN account, or an
 *  Employee ID login (EMPLOYEE, MANAGER, SUPERVISOR, HR, MANAGING_DIRECTOR)
 *  linked to an Employee record. ADMIN-only on the backend. */
export function useUsers() {
  return useQuery({
    queryKey: ['system-users'],
    queryFn: async () => (await api.get<SystemUser[]>('/users')).data,
  });
}

export interface CreateUserPayload {
  role: 'ADMIN' | 'MANAGING_DIRECTOR' | 'HR' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';
  // Required for ADMIN only; omitted for every other role, which signs in
  // with their Employee ID instead (credentials derived server-side from
  // the linked Employee record -- see EMPLOYEE_ID_LOGIN_ROLES).
  username?: string;
  fullName?: string;
  password?: string;
  // Required for every role except ADMIN.
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
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      fullName?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
      // '' explicitly unlinks; omit the field entirely to leave it unchanged.
      employeeId?: string;
    }) => (await api.patch<SystemUser>(`/users/${id}`, payload)).data,
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
