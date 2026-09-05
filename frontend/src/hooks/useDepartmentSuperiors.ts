import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DepartmentSuperior } from '@/types';

export function useDepartmentSuperiors(departmentId?: string, subDepartmentId?: string) {
  return useQuery({
    queryKey: ['department-superiors', departmentId ?? 'all', subDepartmentId ?? 'all'],
    queryFn: async () =>
      (
        await api.get<DepartmentSuperior[]>('/department-superiors', {
          params: { ...(departmentId ? { departmentId } : {}), ...(subDepartmentId ? { subDepartmentId } : {}) },
        })
      ).data,
  });
}

export function useCreateDepartmentSuperior() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      departmentId?: string;
      subDepartmentId?: string;
      employeeId: string;
    }) => (await api.post('/department-superiors', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['department-superiors'] }),
  });
}

export function useDeleteDepartmentSuperior() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/department-superiors/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['department-superiors'] }),
  });
}
