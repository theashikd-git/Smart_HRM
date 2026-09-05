import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SubDepartment } from '@/types';

export function useSubDepartments(departmentId?: string) {
  return useQuery({
    queryKey: ['sub-departments', departmentId ?? 'all'],
    queryFn: async () =>
      (
        await api.get<SubDepartment[]>('/sub-departments', {
          params: departmentId ? { departmentId } : undefined,
        })
      ).data,
  });
}

export function useCreateSubDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; code?: string; departmentId: string; status?: string }) =>
      (await api.post('/sub-departments', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-departments'] }),
  });
}

export function useUpdateSubDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      code?: string;
      departmentId?: string;
      status?: string;
    }) => (await api.patch(`/sub-departments/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-departments'] }),
  });
}

export function useDeleteSubDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/sub-departments/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-departments'] }),
  });
}
