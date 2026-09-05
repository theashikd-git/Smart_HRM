import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Designation } from '@/types';

export function useDesignations() {
  return useQuery({
    queryKey: ['designations'],
    queryFn: async () => (await api.get<Designation[]>('/designations')).data,
  });
}

export function useCreateDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; gradeId?: string; departmentId?: string; status?: string }) =>
      (await api.post('/designations', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['designations'] }),
  });
}

export function useUpdateDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      title?: string;
      gradeId?: string;
      departmentId?: string;
      status?: string;
    }) => (await api.patch(`/designations/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['designations'] }),
  });
}

export function useDeleteDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/designations/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['designations'] }),
  });
}
