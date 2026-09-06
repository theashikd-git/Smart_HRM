import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Department, LeaveApprovalTier } from '@/types';

/** ADMIN-only: the per-department approval chain builder. Every department
 *  is returned (even those with no workflow yet, as approvalWorkflow: null)
 *  so the admin screen can offer "configure" on any of them. */
export function useLeaveWorkflows() {
  return useQuery({
    queryKey: ['leave-workflows'],
    queryFn: async () => (await api.get<Department[]>('/leave/workflows')).data,
  });
}

export interface SaveWorkflowTierInput {
  order: number;
  label: string;
  type: 'REPORTING_SUPERIOR' | 'SPECIFIC_USER';
  approverUserId?: string;
}

export function useSaveLeaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      departmentId,
      tiers,
      isActive,
    }: {
      departmentId: string;
      tiers: SaveWorkflowTierInput[];
      isActive: boolean;
    }) => (await api.put(`/leave/workflows/${departmentId}`, { tiers, isActive })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-workflows'] }),
  });
}

export function useDeleteLeaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (departmentId: string) => (await api.delete(`/leave/workflows/${departmentId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-workflows'] }),
  });
}
