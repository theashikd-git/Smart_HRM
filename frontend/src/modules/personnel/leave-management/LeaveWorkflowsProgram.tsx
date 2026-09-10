'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Users2 } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input } from '@/components/ui/Form';
import { SearchSelect } from '@/components/ui/SearchSelect';
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
 * approval chain builder. Standard, simple flow per tier: write a title,
 * search-select the person who approves at that step, done -- Tier 1 is
 * the highest priority (the first reviewer), Tier 2 reviews only after
 * Tier 1 approves, and so on down the list. A leave request sits at
 * whichever tier is next; each approval bumps it up to the next tier, and
 * the final tier's approval marks the whole request Approved and notifies
 * the employee (see NotificationsService, triggered from LeaveService).
 *
 * "Resolve from the employee's reporting chain" is kept as a secondary,
 * per-tier option for chains that should follow the org chart instead of
 * a fixed person -- off by default so the common case (title + pick a
 * person) stays a two-step flow, per the requested design.
 */
export function LeaveWorkflowsProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: departments, isLoading } = useLeaveWorkflows();
  const { data: users } = useUsers();
  const saveWorkflow = useSaveLeaveWorkflow();
  const deleteWorkflow = useDeleteLeaveWorkflow();

  const approvers = users?.filter((u) => u.role !== 'EMPLOYEE' && u.isActive) ?? [];
  const approverOptions = approvers.map((u) => ({
    id: u.id,
    label: u.fullName,
    // Searched along with the label (see SearchSelect) -- fold in the
    // employee ID (if linked), login username, and role so a match on any
    // of the three finds the right person, not just a name match.
    sublabel: [u.employee?.employeeCode, u.username, ROLE_LABELS[u.role] ?? u.role].filter(Boolean).join(' · '),
  }));

  const [departmentId, setDepartmentId] = useState('');
  const [tiers, setTiers] = useState<EditableTier[]>([]);
  const [isActive, setIsActive] = useState(true);

  const selectedDepartment = departments?.find((d) => d.id === departmentId);
  const departmentOptions = (departments ?? []).map((d) => ({
    id: d.id,
    label: d.name,
    sublabel: d.approvalWorkflow
      ? `${d.approvalWorkflow.tiers.length} tier(s)${d.approvalWorkflow.isActive ? '' : ' — inactive'}`
      : 'No chain configured yet',
  }));

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
    // Defaults to a specific person -- the standard, simple case (title +
    // pick someone). "Resolve from reporting chain" is a per-tier opt-in.
    setTiers((list) => [...list, { key: newTierKey(), label: '', type: 'SPECIFIC_USER', approverUserId: '' }]);
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
          subtitle="Who reviews a department's leave requests, and in what order -- Tier 1 goes first; each tier only sees a request once every tier before it has approved"
        />
        <div className="px-5 pb-5 space-y-5">
          <FieldWrap label="Department" hint="Pick a department to view or build its approval chain">
            <SearchSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={departmentOptions}
              placeholder="Select department"
              searchPlaceholder="Search departments…"
            />
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
                  <Users2 className="h-3.5 w-3.5" /> Approval chain, Tier 1 first
                </div>
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-line" />
                  Active
                </label>
              </div>

              {tiers.length === 0 && (
                <p className="text-xs text-text-muted">
                  No tiers yet. Add one for each person this department's requests must pass through, in order (e.g.
                  Supervisor, then Department Manager, then HR Admin).
                </p>
              )}

              {tiers.map((tier, index) => (
                <div key={tier.key} className="rounded-md border border-line bg-surface-sunken/40 p-3.5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-xs font-medium text-text-secondary flex-1">
                      {index === 0 ? 'Tier 1 · highest priority, reviews first' : `Tier ${index + 1} · reviews after Tier ${index} approves`}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveTier(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-text-muted hover:bg-white disabled:opacity-30"
                      title="Move up (higher priority)"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTier(index, 1)}
                      disabled={index === tiers.length - 1}
                      className="rounded p-1 text-text-muted hover:bg-white disabled:opacity-30"
                      title="Move down (lower priority)"
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldWrap label="Title">
                      <Input
                        placeholder="e.g. Supervisor Review"
                        value={tier.label}
                        onChange={(e) => updateTier(tier.key, { label: e.target.value })}
                      />
                    </FieldWrap>

                    <FieldWrap label="Approver">
                      {tier.type === 'SPECIFIC_USER' ? (
                        <SearchSelect
                          value={tier.approverUserId}
                          onChange={(id) => updateTier(tier.key, { approverUserId: id })}
                          options={approverOptions}
                          placeholder="Search username, employee ID, or name"
                          searchPlaceholder="Type a username, employee ID, or name…"
                        />
                      ) : (
                        <div className="flex h-[34px] items-center rounded-md border border-line bg-white px-3 text-xs text-text-muted">
                          Resolved per request from the employee&apos;s org chart
                        </div>
                      )}
                    </FieldWrap>
                  </div>

                  <label className="mt-2.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                    <input
                      type="checkbox"
                      checked={tier.type === 'REPORTING_SUPERIOR'}
                      onChange={(e) =>
                        updateTier(tier.key, {
                          type: e.target.checked ? 'REPORTING_SUPERIOR' : 'SPECIFIC_USER',
                          approverUserId: '',
                        })
                      }
                      className="rounded border-line"
                    />
                    Resolve from the employee&apos;s reporting superior instead of a fixed person
                  </label>
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
