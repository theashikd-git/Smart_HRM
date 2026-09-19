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
  useUpdateLeaveType,
  useLeaveTypes,
  useEmployeeCategories,
  useCreateEmployeeCategory,
  useUpdateEmployeeCategory,
} from '@/hooks/useLeave';
import { useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/api';
import type { EmployeeCategory, LeaveCategoryPolicy } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const EMPTY_ADD_FORM = {
  leaveName: '',
  daysPerCycle: '',
  carryForward: false,
  maxCarryForwardDays: '',
  carryForwardOnce: false,
};

const EMPTY_EDIT_FORM = {
  leaveName: '',
  daysPerCycle: '',
  carryForward: false,
  maxCarryForwardDays: '',
  carryForwardOnce: false,
};

const EMPTY_CATEGORY_FORM = {
  name: '',
  accruesRollover: true,
  hasFixedPeriod: false,
  defaultPeriodMonths: '',
};

function carryForwardSummary(policy: LeaveCategoryPolicy) {
  if (!policy.carryForward) return 'Resets each year';
  if (policy.carryForwardOnce) return 'Carries forward once, then stops';
  return `Carries forward${policy.maxCarryForwardDays != null ? `, up to ${policy.maxCarryForwardDays} day(s)` : ''}`;
}

// Says when the "Days" entitlement below is actually granted -- the cycle
// itself isn't a field on the leave, it comes entirely from the employee
// category (fixed period like Provision's 6-month probation, or an
// anniversary-based year like Permanent). Used as a hint on the Days field
// so it reads as "16 days, granted each year" instead of a bare number that
// could be mistaken for a validity window.
function cycleLengthLabel(category?: EmployeeCategory | null): string {
  if (!category) return 'each cycle';
  if (category.hasFixedPeriod) {
    return category.defaultPeriodMonths
      ? `once, over the ${category.defaultPeriodMonths}-month period`
      : 'once, over the period set per employee';
  }
  return category.accruesRollover
    ? "each year, from the employee's own hire/category-change anniversary"
    : 'each cycle';
}

// One-line summary of what a category's flags mean for the scheduler --
// shown under its name so HR can tell at a glance what creating/editing a
// category actually does (LeaveSchedulerService reads these same flags
// instead of hardcoding category names).
function categoryBehaviorSummary(category: EmployeeCategory) {
  if (category.hasFixedPeriod) {
    return category.defaultPeriodMonths
      ? `Fixed ${category.defaultPeriodMonths}-month period -- HR is flagged 2 weeks before it ends`
      : 'Fixed period, length set per employee -- HR is flagged 2 weeks before it ends';
  }
  return category.accruesRollover
    ? 'Anniversary-based leave balance rollover'
    : 'No anniversary rollover configured';
}

/**
 * Personnel > Leave Management > Leave Policy -- one screen, grouped by
 * employee category, showing exactly the leaves configured for each -- e.g.
 * under Contractual: Sick, Annual. Categories themselves (Permanent/
 * Provision/Contractual/Trial by default) are HR-editable here too: "+ Add
 * Category" creates a brand-new one, and the pencil icon on each card renames
 * it or changes its behavior flags -- no fixed 4-value list anymore. Adding a
 * leave under a category is free-form: type a name and it's created on the
 * spot (reusing an existing leave type of that name if one exists) rather
 * than requiring a separate trip to a fixed Leave Type list first. This is
 * what LeaveService.initializeBalances and the anniversary rollover scheduler
 * read for each employee's entitlement.
 */
export function LeavePolicyProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: categories, isLoading: categoriesLoading } = useEmployeeCategories();
  const { data: policies, isLoading } = useLeaveCategoryPolicies();
  const { data: leaveTypes } = useLeaveTypes();
  const updatePolicy = useUpdateLeaveCategoryPolicy();
  const deletePolicy = useDeleteLeaveCategoryPolicy();
  const quickAdd = useQuickAddLeaveCategoryPolicy();
  const updateLeaveType = useUpdateLeaveType();
  const createCategory = useCreateEmployeeCategory();
  const updateCategory = useUpdateEmployeeCategory();
  const queryClient = useQueryClient();

  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);

  const [editing, setEditing] = useState<LeaveCategoryPolicy | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState(EMPTY_CATEGORY_FORM);

  const [editingCategory, setEditingCategory] = useState<EmployeeCategory | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState(EMPTY_CATEGORY_FORM);

  const grouped = new Map<string, LeaveCategoryPolicy[]>((categories ?? []).map((c) => [c.id, []]));
  for (const policy of policies ?? []) {
    const list = grouped.get(policy.leaveCategoryId) ?? [];
    list.push(policy);
    grouped.set(policy.leaveCategoryId, list);
  }

  // Compensatory/Maternity (and any other special-rule type) are never
  // pooled per category -- they're granted per-request against their own
  // eligibility check -- so they're surfaced here only as a read-only note,
  // not as something with a day count to configure.
  const specialLeaveTypes = (leaveTypes ?? []).filter((t) => t.specialRule && t.specialRule !== 'NONE');

  function openAdd(categoryId: string) {
    setAddingCategory(categoryId);
    setAddForm(EMPTY_ADD_FORM);
  }

  function closeAdd() {
    setAddingCategory(null);
    setAddForm(EMPTY_ADD_FORM);
  }

  async function handleAdd(category: EmployeeCategory) {
    if (!addForm.leaveName.trim() || addForm.daysPerCycle === '') return;
    try {
      await quickAdd.mutateAsync({
        leaveCategoryId: category.id,
        leaveName: addForm.leaveName.trim(),
        daysPerCycle: Number(addForm.daysPerCycle),
        carryForward: addForm.carryForward,
        maxCarryForwardDays:
          addForm.carryForward && addForm.maxCarryForwardDays ? Number(addForm.maxCarryForwardDays) : undefined,
        carryForwardOnce: addForm.carryForwardOnce,
      });
      toast.success(`${addForm.leaveName.trim()} added to ${category.name}`);
      closeAdd();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function openEdit(policy: LeaveCategoryPolicy) {
    setEditing(policy);
    setEditForm({
      leaveName: policy.leaveType.name,
      daysPerCycle: String(policy.daysPerCycle),
      carryForward: policy.carryForward,
      maxCarryForwardDays: policy.maxCarryForwardDays != null ? String(policy.maxCarryForwardDays) : '',
      carryForwardOnce: policy.carryForwardOnce,
    });
  }

  async function handleEditSave() {
    if (!editing) return;
    const newName = editForm.leaveName.trim();
    if (!newName) {
      toast.error('Leave name cannot be empty');
      return;
    }
    try {
      const tasks = [
        updatePolicy.mutateAsync({
          id: editing.id,
          daysPerCycle: Number(editForm.daysPerCycle),
          carryForward: editForm.carryForward,
          maxCarryForwardDays: editForm.carryForward && editForm.maxCarryForwardDays ? Number(editForm.maxCarryForwardDays) : undefined,
          carryForwardOnce: editForm.carryForwardOnce,
        }),
      ];
      // Renaming here renames the shared leave type itself -- every other
      // category using the same leave (e.g. Permanent's "Sick" and
      // Contractual's "Sick" are the same underlying LeaveType) picks up the
      // new name too, since the name isn't per-category.
      if (newName !== editing.leaveType.name) {
        tasks.push(updateLeaveType.mutateAsync({ id: editing.leaveTypeId, name: newName }));
      }
      await Promise.all(tasks);
      // useUpdateLeaveType only invalidates the leave-types list; this
      // screen reads the name through the joined leave-category-policies
      // query, so refresh that too.
      queryClient.invalidateQueries({ queryKey: ['leave-category-policies'] });
      toast.success('Leave updated');
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(policy: LeaveCategoryPolicy) {
    if (!confirm(`Remove ${policy.leaveType.name} from ${policy.leaveCategory?.name ?? 'this category'}?`)) return;
    try {
      await deletePolicy.mutateAsync(policy.id);
      toast.success('Leave removed');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function openAddCategory() {
    setNewCategoryForm(EMPTY_CATEGORY_FORM);
    setAddingNewCategory(true);
  }

  async function handleAddCategory() {
    const name = newCategoryForm.name.trim();
    if (!name) {
      toast.error('Category name is required');
      return;
    }
    try {
      await createCategory.mutateAsync({
        name,
        accruesRollover: newCategoryForm.accruesRollover,
        hasFixedPeriod: newCategoryForm.hasFixedPeriod,
        defaultPeriodMonths:
          newCategoryForm.hasFixedPeriod && newCategoryForm.defaultPeriodMonths
            ? Number(newCategoryForm.defaultPeriodMonths)
            : undefined,
      });
      toast.success(`${name} added as a new employee category`);
      setAddingNewCategory(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function openEditCategory(category: EmployeeCategory) {
    setEditingCategory(category);
    setEditCategoryForm({
      name: category.name,
      accruesRollover: category.accruesRollover,
      hasFixedPeriod: category.hasFixedPeriod,
      defaultPeriodMonths: category.defaultPeriodMonths != null ? String(category.defaultPeriodMonths) : '',
    });
  }

  async function handleEditCategorySave() {
    if (!editingCategory) return;
    const name = editCategoryForm.name.trim();
    if (!name) {
      toast.error('Category name cannot be empty');
      return;
    }
    try {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        name,
        accruesRollover: editCategoryForm.accruesRollover,
        hasFixedPeriod: editCategoryForm.hasFixedPeriod,
        defaultPeriodMonths:
          editCategoryForm.hasFixedPeriod && editCategoryForm.defaultPeriodMonths
            ? Number(editCategoryForm.defaultPeriodMonths)
            : undefined,
      });
      toast.success('Category updated');
      setEditingCategory(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button size="sm" variant="outline" onClick={openAddCategory}>
          <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
          Add Category
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(categories ?? []).map((category) => {
          const categoryPolicies = grouped.get(category.id) ?? [];
          const isAdding = addingCategory === category.id;

          return (
            <Card key={category.id}>
              <CardHeader
                title={category.name}
                subtitle={categoryBehaviorSummary(category)}
                action={
                  <button
                    onClick={() => openEditCategory(category)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary shrink-0"
                    title="Rename / edit category"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                }
              />

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
                      <FieldWrap
                        label="Days Granted"
                        required
                        hint={`How many days of this leave the employee gets, granted ${cycleLengthLabel(category)} -- not a validity window`}
                      >
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
                    onClick={() => openAdd(category.id)}
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

        {!categoriesLoading && (categories?.length ?? 0) === 0 && (
          <div className="lg:col-span-2">
            <EmptyState
              title="No employee categories yet"
              subtitle="Use “Add Category” above to create your first one, e.g. Permanent or Contractual."
            />
          </div>
        )}
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

      {!isLoading && (policies?.length ?? 0) === 0 && specialLeaveTypes.length === 0 && (categories?.length ?? 0) > 0 && (
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
        title="Edit Leave"
        subtitle={editing?.leaveCategory?.name}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={updatePolicy.isPending || updateLeaveType.isPending}
              onClick={handleEditSave}
              disabled={editForm.daysPerCycle === '' || !editForm.leaveName.trim()}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <FieldWrap
            label="Leave name"
            required
            hint={editing ? `Renaming also updates it for any other employee type using ${editing.leaveType.name}` : undefined}
          >
            <Input
              value={editForm.leaveName}
              onChange={(e) => setEditForm((f) => ({ ...f, leaveName: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap
            label="Days Granted"
            required
            hint={`How many days of this leave the employee gets, granted ${cycleLengthLabel(editing?.leaveCategory)} -- not a validity window`}
          >
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

      <Modal
        open={addingNewCategory}
        onClose={() => setAddingNewCategory(false)}
        title="Add Employee Category"
        subtitle="e.g. Permanent, Provision, Contractual, Trial, or a new one of your own"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddingNewCategory(false)}>
              Cancel
            </Button>
            <Button loading={createCategory.isPending} onClick={handleAddCategory} disabled={!newCategoryForm.name.trim()}>
              Add Category
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <FieldWrap label="Category name" required>
            <Input
              autoFocus
              placeholder="e.g. Intern"
              value={newCategoryForm.name}
              onChange={(e) => setNewCategoryForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap
            label="Anniversary leave rollover"
            hint="Carries unused leave into each employee's next personal leave year, per that leave's own Carry Forward setting"
          >
            <Select
              value={newCategoryForm.accruesRollover ? 'yes' : 'no'}
              onChange={(e) => setNewCategoryForm((f) => ({ ...f, accruesRollover: e.target.value === 'yes' }))}
            >
              <option value="yes">Yes -- rolls over on each anniversary</option>
              <option value="no">No</option>
            </Select>
          </FieldWrap>
          <FieldWrap
            label="Fixed period (probation / trial style)"
            hint="Flags HR in the Audit Log 2 weeks before this period ends for each employee"
          >
            <Select
              value={newCategoryForm.hasFixedPeriod ? 'yes' : 'no'}
              onChange={(e) => setNewCategoryForm((f) => ({ ...f, hasFixedPeriod: e.target.value === 'yes' }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes -- has a probation/trial-style period</option>
            </Select>
          </FieldWrap>
          {newCategoryForm.hasFixedPeriod && (
            <FieldWrap
              label="Default period length (months)"
              hint="Leave blank if HR should pick the length per employee instead (e.g. Trial)"
            >
              <Input
                type="number"
                min={1}
                value={newCategoryForm.defaultPeriodMonths}
                onChange={(e) => setNewCategoryForm((f) => ({ ...f, defaultPeriodMonths: e.target.value }))}
              />
            </FieldWrap>
          )}
        </div>
      </Modal>

      <Modal
        open={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title="Edit Employee Category"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button
              loading={updateCategory.isPending}
              onClick={handleEditCategorySave}
              disabled={!editCategoryForm.name.trim()}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <FieldWrap label="Category name" required hint="Renaming keeps all its leave policies and employees as they are">
            <Input
              value={editCategoryForm.name}
              onChange={(e) => setEditCategoryForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap
            label="Anniversary leave rollover"
            hint="Carries unused leave into each employee's next personal leave year, per that leave's own Carry Forward setting"
          >
            <Select
              value={editCategoryForm.accruesRollover ? 'yes' : 'no'}
              onChange={(e) => setEditCategoryForm((f) => ({ ...f, accruesRollover: e.target.value === 'yes' }))}
            >
              <option value="yes">Yes -- rolls over on each anniversary</option>
              <option value="no">No</option>
            </Select>
          </FieldWrap>
          <FieldWrap
            label="Fixed period (probation / trial style)"
            hint="Flags HR in the Audit Log 2 weeks before this period ends for each employee"
          >
            <Select
              value={editCategoryForm.hasFixedPeriod ? 'yes' : 'no'}
              onChange={(e) => setEditCategoryForm((f) => ({ ...f, hasFixedPeriod: e.target.value === 'yes' }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes -- has a probation/trial-style period</option>
            </Select>
          </FieldWrap>
          {editCategoryForm.hasFixedPeriod && (
            <FieldWrap
              label="Default period length (months)"
              hint="Leave blank if HR should pick the length per employee instead (e.g. Trial)"
            >
              <Input
                type="number"
                min={1}
                value={editCategoryForm.defaultPeriodMonths}
                onChange={(e) => setEditCategoryForm((f) => ({ ...f, defaultPeriodMonths: e.target.value }))}
              />
            </FieldWrap>
          )}
        </div>
      </Modal>
    </ProgramWorkspace>
  );
}
