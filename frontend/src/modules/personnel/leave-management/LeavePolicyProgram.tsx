'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { PlusCircle, Trash2, Pencil } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card, CardHeader, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import {
  useLeaveCategoryPolicies,
  useCreateLeaveCategoryPolicy,
  useUpdateLeaveCategoryPolicy,
  useDeleteLeaveCategoryPolicy,
  useLeaveTypes,
} from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import type { LeaveCategoryPolicy } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const CATEGORY_LABELS: Record<string, string> = {
  PERMANENT: 'Permanent',
  PROVISION: 'Provision (Probation)',
  CONTRACTUAL: 'Contractual',
  TRIAL: 'Trial',
};

const EMPTY_FORM = {
  leaveCategory: 'PERMANENT',
  leaveTypeId: '',
  daysPerCycle: '',
  carryForward: false,
  maxCarryForwardDays: '',
  carryForwardOnce: false,
};

/**
 * Personnel > Leave Management > Leave Policy -- how many days each of the
 * 7 employee-category tracks (Permanent/Provision/Contractual/Trial) gets
 * per leave type, and whether/how it carries forward. This is what
 * LeaveService.initializeBalances and the anniversary rollover scheduler
 * read instead of a flat per-leave-type entitlement, since the HR policy
 * spec gives each category its own numbers (e.g. Permanent Casual = 10,
 * Provision Casual = 5).
 */
export function LeavePolicyProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: policies, isLoading } = useLeaveCategoryPolicies();
  const { data: leaveTypes } = useLeaveTypes();
  const createPolicy = useCreateLeaveCategoryPolicy();
  const updatePolicy = useUpdateLeaveCategoryPolicy();
  const deletePolicy = useDeleteLeaveCategoryPolicy();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveCategoryPolicy | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Compensatory/Maternity are never pooled-balance leave types (they're
  // granted per-request against their own eligibility check), so a policy
  // row for them would never be read by anything -- keep them out of the
  // picker to avoid HR configuring an entitlement that's silently ignored.
  const policyableLeaveTypes = (leaveTypes ?? []).filter((t) => !t.specialRule || t.specialRule === 'NONE');

  const canSubmit = !!form.leaveCategory && !!form.leaveTypeId && form.daysPerCycle !== '';

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(policy: LeaveCategoryPolicy) {
    setEditing(policy);
    setForm({
      leaveCategory: policy.leaveCategory,
      leaveTypeId: policy.leaveTypeId,
      daysPerCycle: String(policy.daysPerCycle),
      carryForward: policy.carryForward,
      maxCarryForwardDays: policy.maxCarryForwardDays != null ? String(policy.maxCarryForwardDays) : '',
      carryForwardOnce: policy.carryForwardOnce,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    const payload = {
      daysPerCycle: Number(form.daysPerCycle),
      carryForward: form.carryForward,
      maxCarryForwardDays: form.carryForward && form.maxCarryForwardDays ? Number(form.maxCarryForwardDays) : undefined,
      carryForwardOnce: form.carryForwardOnce,
    };
    try {
      if (editing) {
        await updatePolicy.mutateAsync({ id: editing.id, ...payload });
        toast.success('Leave policy updated');
      } else {
        await createPolicy.mutateAsync({
          leaveCategory: form.leaveCategory,
          leaveTypeId: form.leaveTypeId,
          ...payload,
        });
        toast.success('Leave policy created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(policy: LeaveCategoryPolicy) {
    if (!confirm(`Remove the ${CATEGORY_LABELS[policy.leaveCategory]} / ${policy.leaveType.name} policy?`)) return;
    try {
      await deletePolicy.mutateAsync(policy.id);
      toast.success('Leave policy removed');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button onClick={openCreate}>
          <PlusCircle className="h-4 w-4" />
          Add Policy
        </Button>
      }
    >
      <Card>
        <CardHeader
          title="Leave Category Policies"
          subtitle="Per employee-type entitlement for each leave type -- what Initialize Balances and the anniversary rollover use instead of a flat days-per-year"
        />

        <Table>
          <Thead>
            <tr>
              <Th>Employee Type</Th>
              <Th>Leave Type</Th>
              <Th>Days</Th>
              <Th>Carry Forward</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {policies?.map((policy) => (
              <Tr key={policy.id}>
                <Td>
                  <Badge>{CATEGORY_LABELS[policy.leaveCategory] ?? policy.leaveCategory}</Badge>
                </Td>
                <Td className="font-medium">{policy.leaveType.name}</Td>
                <Td>{policy.daysPerCycle}</Td>
                <Td className="text-xs text-text-secondary">
                  {!policy.carryForward
                    ? 'Resets each year'
                    : policy.carryForwardOnce
                      ? 'Carries forward once, then no further grants'
                      : `Carries forward${policy.maxCarryForwardDays != null ? `, up to ${policy.maxCarryForwardDays} day(s)` : ''}`}
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(policy)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(policy)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (policies?.length ?? 0) === 0 && (
          <EmptyState
            title="No leave policies configured yet"
            subtitle="Add one per employee type and leave type, e.g. Permanent + Casual = 10 days."
          />
        )}

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? 'Edit Leave Policy' : 'Add Leave Policy'}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={createPolicy.isPending || updatePolicy.isPending}
                onClick={handleSave}
                disabled={!canSubmit}
              >
                {editing ? 'Save Changes' : 'Create Policy'}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrap label="Employee Type" required>
              <Select
                value={form.leaveCategory}
                onChange={(e) => setForm((f) => ({ ...f, leaveCategory: e.target.value }))}
                disabled={!!editing}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldWrap>
            <FieldWrap label="Leave Type" required>
              <Select
                value={form.leaveTypeId}
                onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
                disabled={!!editing}
              >
                <option value="">Select</option>
                {policyableLeaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FieldWrap>
            <FieldWrap label="Days" required>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.daysPerCycle}
                onChange={(e) => setForm((f) => ({ ...f, daysPerCycle: e.target.value }))}
              />
            </FieldWrap>
            <FieldWrap label="Carry Forward">
              <Select
                value={form.carryForward ? 'yes' : 'no'}
                onChange={(e) => setForm((f) => ({ ...f, carryForward: e.target.value === 'yes' }))}
              >
                <option value="no">Does not carry forward -- resets each year</option>
                <option value="yes">Carries forward</option>
              </Select>
            </FieldWrap>
            {form.carryForward && (
              <>
                <FieldWrap label="Max Carry-Forward Days" hint="Leave blank for no cap">
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.maxCarryForwardDays}
                    onChange={(e) => setForm((f) => ({ ...f, maxCarryForwardDays: e.target.value }))}
                  />
                </FieldWrap>
                <FieldWrap
                  label="Carry Forward Once"
                  hint="Only rolls over on the employee's first anniversary, then no further grants (e.g. Contractual leave)"
                >
                  <Select
                    value={form.carryForwardOnce ? 'yes' : 'no'}
                    onChange={(e) => setForm((f) => ({ ...f, carryForwardOnce: e.target.value === 'yes' }))}
                  >
                    <option value="no">Repeats every year</option>
                    <option value="yes">Once only, then stops</option>
                  </Select>
                </FieldWrap>
              </>
            )}
          </div>
        </Modal>
      </Card>
    </ProgramWorkspace>
  );
}
