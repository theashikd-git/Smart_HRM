'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowUp, ArrowDown, GitBranch, Save } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useUsers } from '@/hooks/useUsers';
import { useLeaveWorkflows, useSaveLeaveWorkflow, useDeleteLeaveWorkflow } from '@/hooks/useLeaveWorkflows';
import { apiErrorMessage } from '@/lib/api';
import type { LeaveTierType } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  HR: 'HR Officer',
  MANAGER: 'Manager',
  SUPERVISOR: 'Supervisor',
  EMPLOYEE: 'Employee (self-service)',
};

interface EditableTier {
  key: string; // stable React key, independent of order (order can change via move up/down)
  label: string;
  type: LeaveTierType;
  approverUserId: string;
}

let tierKeySeq = 0;
function newTierKey() {
  tierKeySeq += 1;
  return `t${Date.now()}-${tierKeySeq}`;
}

/**
 * Personnel > Leave Management > Leave Workflows -- the per-department
 * approval chain builder. Which tiers a leave request must clear, in order,
 * before it's approved, and who resolves each tier (either "whoever this
 * employee's org chart says is their reporting superior", resolved fresh
 * per request, or one specific named person). Moved here from System
 * Settings so every leave-related admin screen lives under one section.
 */
export function LeaveWorkflowsProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: departments, isLoading } = useLeaveWorkflows();
  const { data: users } = useUsers();
  const saveWorkflow = useSaveLeaveWorkflow();
  const deleteWorkflow = useDeleteLeaveWorkflow();

  const approvers = users?.filter((u) => u.role !== 'EMPLOYEE' && u.isActive) ?? [];

  const [departmentId, setDepartmentId] = useState('');
  const [tiers, setTiers] = useState<EditableTier[]>([]);
  const [isActive, setIsActive] = useState(true);

  const selectedDepartment = departments?.find((d) => d.id === departmentId);

  useEffect(() => {
    if (!selectedDepartment) {
      setTiers([]);
      setIsActive(true);
      return;
    }
    const existing = selectedDepartment.approvalWorkflow;
    setIsActive(existing?.isActive ?? true);
    setTiers(
      (existing?.tiers ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((t) => ({
          key: newTierKey(),
          label: t.label,
          type: t.type,
          approverUserId: t.approverUserId ?? '',
        })),
    );
    // Re-sync whenever the selected department (or its saved workflow) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, selectedDepartment?.approvalWorkflow]);

  function addTier() {
    setTiers((list) => [...list, { key: newTierKey(), label: '', type: 'REPORTING_SUPERIOR', approverUserId: '' }]);
  }

  function removeTier(key: string) {
    setTiers((list) => list.filter((t) => t.key !== key));
  }

  function updateTier(key: string, patch: Partial<EditableTier>) {
    setTiers((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  function moveTier(index: number, direction: -1 | 1) {
    setTiers((list) => {
      const next = list.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const canSave =
    !!departmentId &&
    tiers.length > 0 &&
    tiers.every((t) => t.label.trim().length > 0 && (t.type !== 'SPECIFIC_USER' || !!t.approverUserId));

  async function handleSave() {
    try {
      await saveWorkflow.mutateAsync({
        departmentId,
        isActive,
        tiers: tiers.map((t, index) => ({
          order: index + 1,
          label: t.label.trim(),
          type: t.type,
          approverUserId: t.type === 'SPECIFIC_USER' ? t.approverUserId : undefined,
        })),
      });
      toast.success('Approval workflow saved');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleRemoveWorkflow() {
    if (!selectedDepartment?.approvalWorkflow) return;
    if (!confirm(`Remove the approval chain for ${selectedDepartment.name}? It will revert to the simple flow (any ADMIN/HR/Manager can decide any request).`))
      return;
    try {
      await deleteWorkflow.mutateAsync(departmentId);
      toast.success('Reverted to the simple approval flow');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace title={tab.title} breadcrumb={tab.breadcrumb}>
      <Card>
        <CardHeader
          title="Leave Approval Workflows"
          subtitle="Build each department's approval chain -- the ordered tiers a leave request must clear, in order, before it's approved"
        />
        <div className="px-5 pb-5 space-y-4">
          <FieldWrap label="Department" hint="Pick a department to view or build its approval chain">
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Select department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.approvalWorkflow ? `(${d.approvalWorkflow.tiers.length} tier(s)${d.approvalWorkflow.isActive ? '' : ' — inactive'})` : '(no chain configured)'}
                </option>
              ))}
            </Select>
          </FieldWrap>

          {!departmentId && !isLoading && (
            <p className="text-xs text-text-muted">
              A department with no chain configured keeps the simple flow: any Administrator, HR Officer, or Manager can
              approve or reject any request in it.
            </p>
          )}

          {departmentId && (
            <div className="rounded-lg border border-line p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                  <GitBranch className="h-3.5 w-3.5" /> Approval chain, in order
                </div>
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-line" />
                  Active
                </label>
              </div>

              {tiers.length === 0 && (
                <p className="text-xs text-text-muted">
                  No tiers yet. Add one for each approver this department's requests must pass through, in order (e.g.
                  Supervisor, then Department Manager, then HR Admin).
                </p>
              )}

              {tiers.map((tier, index) => (
                <div key={tier.key} className="rounded-md border border-line bg-surface-sunken/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-xs text-text-muted flex-1">
                      {index === 0 ? 'First approver' : `After tier ${index}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveTier(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-text-muted hover:bg-white disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTier(index, 1)}
                      disabled={index === tiers.length - 1}
                      className="rounded p-1 text-text-muted hover:bg-white disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTier(tier.key)}
                      className="rounded p-1 text-text-muted hover:bg-danger-soft hover:text-danger"
                      title="Remove tier"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="Tier label, e.g. Supervisor"
                      value={tier.label}
                      onChange={(e) => updateTier(tier.key, { label: e.target.value })}
                    />
                    <Select
                      value={tier.type}
                      onChange={(e) => updateTier(tier.key, { type: e.target.value as LeaveTierType, approverUserId: '' })}
                    >
                      <option value="REPORTING_SUPERIOR">Employee&apos;s Reporting Superior</option>
                      <option value="SPECIFIC_USER">Specific Person</option>
                    </Select>
                    {tier.type === 'SPECIFIC_USER' ? (
                      <Select
                        value={tier.approverUserId}
                        onChange={(e) => updateTier(tier.key, { approverUserId: e.target.value })}
                      >
                        <option value="">Select approver</option>
                        {approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({ROLE_LABELS[u.role] ?? u.role})
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <p className="flex items-center text-xs text-text-muted px-1">
                        Resolved per request from the employee&apos;s org chart
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" size="sm" onClick={addTier}>
                  <Plus className="h-3.5 w-3.5" /> Add Tier
                </Button>
                <div className="flex items-center gap-2">
                  {selectedDepartment?.approvalWorkflow && (
                    <Button variant="outline" size="sm" onClick={handleRemoveWorkflow} loading={deleteWorkflow.isPending}>
                      Revert to Simple Flow
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={!canSave} loading={saveWorkflow.isPending}>
                    <Save className="h-3.5 w-3.5" /> Save Chain
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </ProgramWorkspace>
  );
}
