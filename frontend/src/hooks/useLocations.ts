import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Location } from '@/types';

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get<Location[]>('/locations')).data,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      code?: string;
      type?: string;
      address?: string;
      branchId?: string;
      status?: string;
    }) => (await api.post('/locations', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      code?: string;
      type?: string;
      address?: string;
      branchId?: string;
      status?: string;
    }) => (await api.patch(`/locations/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/locations/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}
