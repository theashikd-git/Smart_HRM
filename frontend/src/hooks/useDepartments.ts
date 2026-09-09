import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Department } from '@/types';

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
  });
}

export interface CreateDepartmentSubRow {
  name: string;
  headEmployeeId?: string;
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      code: string;
      headEmployeeId?: string;
      branchId?: string;
      locationId?: string;
      status?: string;
      // Created together with the department in one transaction -- see
      // the "Add Department" popup's Sub-Departments section.
      subDepartments?: CreateDepartmentSubRow[];
    }): Promise<Department> => (await api.post('/departments', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      code?: string;
      headEmployeeId?: string;
      branchId?: string;
      locationId?: string;
      status?: string;
      // Edit Department popup: new rows to add and existing ids to remove,
      // applied in the same transaction as the rest of this update.
      subDepartments?: CreateDepartmentSubRow[];
      removeSubDepartmentIds?: string[];
    }): Promise<Department> => (await api.patch(`/departments/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/departments/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}
