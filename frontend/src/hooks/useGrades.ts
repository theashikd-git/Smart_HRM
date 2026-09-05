import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Grade } from '@/types';

export function useGrades() {
  return useQuery({
    queryKey: ['grades'],
    queryFn: async () => (await api.get<Grade[]>('/grades')).data,
  });
}

export function useCreateGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      level?: number;
      minSalary?: number;
      maxSalary?: number;
      benefits?: string;
      status?: string;
    }) => (await api.post('/grades', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grades'] }),
  });
}

export function useUpdateGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      level?: number;
      minSalary?: number;
      maxSalary?: number;
      benefits?: string;
      status?: string;
    }) => (await api.patch(`/grades/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grades'] }),
  });
}

export function useDeleteGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/grades/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grades'] }),
  });
}
