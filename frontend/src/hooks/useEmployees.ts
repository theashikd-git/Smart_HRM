import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Employee, Paginated } from '@/types';

export interface EmployeeQuery {
  search?: string;
  departmentId?: string;
  designationId?: string;
  shiftId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useEmployees(query: EmployeeQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: async () =>
      (await api.get<Paginated<Employee>>('/employees', { params: query })).data,
    enabled: options?.enabled,
  });
}

export function useEmployee(id?: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => (await api.get<Employee>(`/employees/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Employee>) => (await api.post<Employee>('/employees', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Employee> & { id: string }) =>
      (await api.patch<Employee>(`/employees/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee'] });
    },
  });
}

export function useDisableEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/employees/${id}/disable`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useActivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/employees/${id}/activate`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

// HR/Admin "forgot password" reset for an employee's self-service portal
// login -- the backend generates a fresh temporary password, forces the
// employee to set their own on next sign-in, and returns the temporary
// password ONCE here so it can be shown to HR to relay to the employee.
export function useResetEmployeePassword() {
  return useMutation({
    mutationFn: async (id: string) =>
      // created: true when this employee had no self-service login yet
      // (e.g. added before login auto-provisioning existed) -- the backend
      // creates one on the spot instead of erroring, so the button doubles
      // as "create login" for those employees.
      (await api.post<{ tempPassword: string; created: boolean }>(`/employees/${id}/reset-password`)).data,
  });
}

export interface DeleteEmployeeResult {
  success: boolean;
  // Present only when the employee had been pushed to a biometric device --
  // tells the caller whether the device-side removal actually succeeded, so
  // a failure there (nothing left in Smart HRM to retry against afterwards)
  // isn't silently swallowed behind a generic "deleted" success toast.
  deviceRemoval?: { success: boolean; message?: string };
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<DeleteEmployeeResult> => (await api.delete(`/employees/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}
