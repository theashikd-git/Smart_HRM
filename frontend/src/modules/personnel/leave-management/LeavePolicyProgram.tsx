'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { PlusCircle, Trash2, Pencil, Info } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card, CardHeader, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Table';
import {
  useLeaveCategoryPolicies,
  useUpdateLeaveCategoryPolicy,
  useDeleteLeaveCategoryPolicy,
  useQuickAddLeaveCategoryPolicy,
  useLeaveTypes,
} from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import type { LeaveCategoryPolicy } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const CATEGORY_ORDER = ['PERMANENT', 'PROVISION', 'CONTRACTUAL', 'TRIAL'];

const CATEGORY_LABELS: Record<string, string> = {
  PERMANENT: 'Permanent',
  PROVISION: 'Provision (Probation)',
  CONTRACTUAL: 'Contractual',
  TRIAL: 'Trial',
};

const CATEGORY_HINTS: Record<string, string> = {
  PERMANENT: 'Confirmed staff on permanent contracts',
  PROVISION: 'New hires on probation, before confirmation',
  CONTRACTUAL: 'Staff on fixed-term contracts',
  TRIAL: 'Short trial period before a category is decided',
};

const EMPTY_ADD_FORM = {
  leaveName: '',
  daysPerCycle: '',
  carryForward: false,
  maxCarryForwardDays: '',
  carryForwardOnce: false,
};

const EMPTY_EDIT_FORM = {
  daysPerCycle: '',
  carryForward: false,
  maxCarryForwardDays: '',
  carryForwardOnce: false,
};

function carryForwardSummary(policy: LeaveCategoryPolicy) {
  if (!policy.carryForward) return 'Resets each year';
  if (policy.carryForwardOnce) return 'Carries forward once, then stops';
  return `Carries forward${policy.maxCarryForwardDays != null ? `, up to ${policy.maxCarryForwardDays} day(s)` : ''}`;
}

/**
 * Personnel > Leave Management > Leave Policy -- one screen, grouped by
 * employee category (Permanent/Provision/Contractual/Trial), showing exactly
 * the leaves configured for each -- e.g. under Contractual: Sick, Annual.
 * Adding a leave is free-form: type a name under the category it belongs to
 * and it's created on the spot (reusing an existing leave type of that name
 * if one exists) rather than requiring a separate trip to a fixed Leave Type
 * list first. This is what LeaveService.initializeBalances and the
 * anniversary rollover scheduler read for each employee's entitlement.
 */
export function LeavePolicyProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: policies, isLoading } = useLeaveCategoryPolicies();
  const { data: leaveTypes } = useLeaveTypes();
  const updatePolicy = useUpdateLeaveCategoryPolicy();
  const deletePolicy = useDeleteLeaveCategoryPolicy();
  const quickAdd = useQuickAddLeaveCategoryPolicy();

  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);

  const [editing, setEditing] = useState<LeaveCategoryPolicy | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const grouped = new Map<string, LeaveCategoryPolicy[]>(CATEGORY_ORDER.map((c) => [c, []]));
  for (const policy of policies ?? []) {
    const list = grouped.get(policy.leaveCategory) ?? [];
    list.push(policy);
    grouped.set(policy.leaveCategory, list);
  }

  // Compensatory/Maternity (and any other special-rule type) are never
  // pooled per category -- they're granted per-request against their own
  // eligibility check -- so they're surfaced here only as a read-only note,
  // not as something with a day count to configure.
  const specialLeaveTypes = (leaveTypes ?? []).filter((t) => t.specialRule && t.specialRule !== 'NONE');

  function openAdd(category: string) {
    setAddingCategory(category);
    setAddForm(EMPTY_ADD_FORM);
  }

  function closeAdd() {
    setAddingCategory(null);
    setAddForm(EMPTY_ADD_FORM);
  }

  async function handleAdd(category: string) {
    if (!addForm.leaveName.trim() || addForm.daysPerCycle === '') return;
    try {
      await quickAdd.mutateAsync({
        leaveCategory: category,
        leaveName: addForm.leaveName.trim(),
        daysPerCycle: Number(addForm.daysPerCycle),
        carryForward: addForm.carryForward,
        maxCarryForwardDays:
          addForm.carryForward && addForm.maxCarryForwardDays ? Number(addForm.maxCarryForwardDays) : undefined,
        carryForwardOnce: addForm.carryForwardOnce,
      });
      toast.success(`${addForm.leaveName.trim()} added to ${CATEGORY_LABELS[category] ?? category}`);
      closeAdd();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function openEdit(policy: LeaveCategoryPolicy) {
    setEditing(policy);
    setEditForm({
      daysPerCycle: String(policy.daysPerCycle),
      carryForward: policy.carryForward,
      maxCarryForwardDays: policy.maxCarryForwardDays != null ? String(policy.maxCarryForwardDays) : '',
      carryForwardOnce: policy.carryForwardOnce,
    });
  }

  async function handleEditSave() {
    if (!editing) return;
    try {
      await updatePolicy.mutateAsync({
        id: editing.id,
        daysPerCycle: Number(editForm.daysPerCycle),
        carryForward: editForm.carryForward,
        maxCarryForwardDays: editForm.carryForward && editForm.maxCarryForwardDays ? Number(editForm.maxCarryForwardDays) : undefined,
        carryForwardOnce: editForm.carryForwardOnce,
      });
      toast.success('Leave policy updated');
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(policy: LeaveCategoryPolicy) {
    if (!confirm(`Remove ${policy.leaveType.name} from ${CATEGORY_LABELS[policy.leaveCategory] ?? policy.leaveCategory}?`)) return;
    try {
      await deletePolicy.mutateAsync(policy.id);
      toast.success('Leave removed');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace title={tab.title} breadcrumb={tab.breadcrumb}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CATEGORY_ORDER.map((category) => {
          const categoryPolicies = grouped.get(category) ?? [];
          const isAdding = addingCategory === category;

          return (
            <Card key={category}>
              <CardHeader title={CATEGORY_LABELS[category]} subtitle={CATEGORY_HINTS[category]} />

              <div className="px-5 pb-5 flex flex-col gap-2">
                {!isLoading && categoryPolicies.length === 0 && !isAdding && (
                  <p className="text-xs text-text-muted py-2">No leaves configured yet.</p>
                )}

                {categoryPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sunken/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{policy.leaveType.name}</p>
                      <p className="text-xs text-text-secondary">{carryForwardSummary(policy)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge>{policy.daysPerCycle} days</Badge>
                      <button
                        onClick={() => openEdit(policy)}
                        className="rounded-md p-1.5 text-text-muted hover:bg-white hover:text-text-primary"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(policy)}
                        className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {isAdding ? (
                  <div className="rounded-lg border border-dashed border-accent/50 bg-accent/5 p-3 flex flex-col gap-3 mt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FieldWrap label="Leave name" required>
                        <Input
                          autoFocus
                          placeholder="e.g. Sick, Annual, Casual"
                          value={addForm.leaveName}
                          onChange={(e) => setAddForm((f) => ({ ...f, leaveName: e.target.value }))}
                        />
                      </FieldWrap>
                      <FieldWrap label="Days" required>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={addForm.daysPerCycle}
                          onChange={(e) => setAddForm((f) => ({ ...f, daysPerCycle: e.target.value }))}
                      />
                      </FieldWrap>
                      <FieldWrap label="Carry forward">
                        <Select
                          value={addForm.carryForward ? 'yes' : 'no'}
                          onChange={(e) => setAddForm((f) => ({ ...f, carryForward: e.target.value === 'yes' }))}
                        >
                          <option value="no">Resets each year</option>
                          <option value="yes">Carries forward</option>
                        </Select>
                      </FieldWrap>
                      {addForm.carryForward && (
                        <FieldWrap label="Max carry-forward days" hint="Leave blank for no cap">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={addForm.maxCarryForwardDays}
                            onChange={(e) => setAddForm((f) => ({ ...f, maxCarryForwardDays: e.target.value }))}
                          />
                        </FieldWrap>
                      )}
                      {addForm.carryForward && (
                        <FieldWrap
                          label="Carry forward once"
                          hint="Only rolls over on the employee's first anniversary, then stops"
                        >
                          <Select
                            value={addForm.carryForwardOnce ? 'yes' : 'no'}
                            onChange={(e) => setAddForm((f) => ({ ...f, carryForwardOnce: e.target.value === 'yes' }))}
                          >
                            <option value="no">Repeats every year</option>
                            <option value="yes">Once only, then stops</option>
                          </Select>
                        </FieldWrap>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={closeAdd}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        loading={quickAdd.isPending}
                        disabled={!addForm.leaveName.trim() || addForm.daysPerCycle === ''}
                        onClick={() => handleAdd(category)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openAdd(category)}
                    className="mt-1 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add Leave
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {specialLeaveTypes.length > 0 && (
        <Card className="mt-4">
          <CardHeader
            title="Special Leave Types"
            subtitle="Granted per-request against their own eligibility check, not a per-category day count -- so they don't appear above"
          />
          <div className="px-5 pb-5 flex flex-wrap gap-2">
            {specialLeaveTypes.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-sunken/50 px-3 py-1.5 text-xs text-text-secondary"
              >
                <Info className="h-3.5 w-3.5 text-text-muted" />
                {t.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      {!isLoading && (policies?.length ?? 0) === 0 && specialLeaveTypes.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="No leave policies configured yet"
            subtitle="Use “Add Leave” under an employee type, e.g. Contractual + Sick = 10 days."
          />
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.leaveType.name}` : 'Edit Leave'}
        subtitle={editing ? CATEGORY_LABELS[editing.leaveCategory] ?? editing.leaveCategory : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={updatePolicy.isPending} onClick={handleEditSave} disabled={editForm.daysPerCycle === ''}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <FieldWrap label="Days" required>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={editForm.daysPerCycle}
              onChange={(e) => setEditForm((f) => ({ ...f, daysPerCycle: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap label="Carry Forward">
            <Select
              value={editForm.carryForward ? 'yes' : 'no'}
              onChange={(e) => setEditForm((f) => ({ ...f, carryForward: e.target.value === 'yes' }))}
            >
              <option value="no">Does not carry forward -- resets each year</option>
              <option value="yes">Carries forward</option>
            </Select>
          </FieldWrap>
          {editForm.carryForward && (
            <>
              <FieldWrap label="Max Carry-Forward Days" hint="Leave blank for no cap">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={editForm.maxCarryForwardDays}
                  onChange={(e) => setEditForm((f) => ({ ...f, maxCarryForwardDays: e.target.value }))}
                />
              </FieldWrap>
              <FieldWrap
                label="Carry Forward Once"
                hint="Only rolls over on the employee's first anniversary, then no further grants"
              >
                <Select
                  value={editForm.carryForwardOnce ? 'yes' : 'no'}
                  onChange={(e) => setEditForm((f) => ({ ...f, carryForwardOnce: e.target.value === 'yes' }))}
                >
                  <option value="no">Repeats every year</option>
                  <option value="yes">Once only, then stops</option>
                </Select>
              </FieldWrap>
            </>
          )}
        </div>
      </Modal>
    </ProgramWorkspace>
  );
}
