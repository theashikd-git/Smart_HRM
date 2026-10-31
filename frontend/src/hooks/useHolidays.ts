import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Holiday } from '@/types';

export function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    queryFn: async () => (await api.get<Holiday[]>('/holidays')).data,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; date: string; type?: string }) =>
      (await api.post('/holidays', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      date?: string;
      type?: string;
    }) => (await api.patch(`/holidays/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/holidays/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}
