import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Section } from '@/types';

export function useSections(departmentId?: string, subDepartmentId?: string) {
  return useQuery({
    queryKey: ['sections', departmentId ?? 'all', subDepartmentId ?? 'all'],
    queryFn: async () =>
      (
        await api.get<Section[]>('/sections', {
          params: { ...(departmentId ? { departmentId } : {}), ...(subDepartmentId ? { subDepartmentId } : {}) },
        })
      ).data,
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      code: string;
      departmentId: string;
      subDepartmentId?: string;
      status?: string;
    }) => (await api.post('/sections', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections'] }),
  });
}

export function useUpdateSection() {
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
      subDepartmentId?: string;
      status?: string;
    }) => (await api.patch(`/sections/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections'] }),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/sections/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections'] }),
  });
}
