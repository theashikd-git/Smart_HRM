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

export function useEmployees(query: EmployeeQuery) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: async () =>
      (await api.get<Paginated<Employee>>('/employees', { params: query })).data,
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
