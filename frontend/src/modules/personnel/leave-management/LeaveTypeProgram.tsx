'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { PlusCircle, Trash2 } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card, CardHeader, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useLeaveTypes, useCreateLeaveType, useDeactivateLeaveType } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import type { LeaveType } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const EMPTY_TYPE_FORM = {
  name: '',
  code: '',
  daysPerYear: '',
  paid: true,
  carryForward: false,
  maxCarryForwardDays: '',
  requiresApproval: true,
  color: '#22c55e',
};

/**
 * Personnel > Leave Management > Leave Type -- the catalogue of leave
 * types employees can apply against (Casual, Sick, Annual, Compensatory,
 * and any others HR wants to add), each with its own yearly entitlement,
 * paid/unpaid status, carry-forward rule, and whether it needs approval.
 * Moved here from the top-level Leave module's internal tab so every
 * leave-related admin screen lives under one Personnel section.
 */
export function LeaveTypeProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: leaveTypes, isLoading } = useLeaveTypes(true);
  const createType = useCreateLeaveType();
  const deactivateType = useDeactivateLeaveType();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_TYPE_FORM);

  const canSubmit = form.name.trim().length > 0 && form.code.trim().length > 0;

  async function handleCreate() {
    try {
      await createType.mutateAsync({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        daysPerYear: form.daysPerYear ? Number(form.daysPerYear) : 0,
        paid: form.paid,
        carryForward: form.carryForward,
        maxCarryForwardDays: form.carryForward && form.maxCarryForwardDays ? Number(form.maxCarryForwardDays) : undefined,
        requiresApproval: form.requiresApproval,
        color: form.color,
      });
      toast.success('Leave type created');
      setModalOpen(false);
      setForm(EMPTY_TYPE_FORM);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDeactivate(type: LeaveType) {
    if (!confirm(`Deactivate "${type.name}"? Existing balances and requests are kept, but it can no longer be used for new requests.`)) return;
    try {
      await deactivateType.mutateAsync(type.id);
      toast.success(`${type.name} deactivated`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button
          onClick={() => {
            setForm(EMPTY_TYPE_FORM);
            setModalOpen(true);
          }}
        >
          <PlusCircle className="h-4 w-4" />
          Add Leave Type
        </Button>
      }
    >
      <Card>
        <CardHeader
          title="Leave Types"
          subtitle="Entitlements, carry-forward rules, and approval requirements for each leave type"
        />

        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th>Days / Year</Th>
              <Th>Paid</Th>
              <Th>Carry Forward</Th>
              <Th>Approval</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {leaveTypes?.map((type) => (
              <Tr key={type.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: type.color ?? '#94a3b8' }}
                    />
                    <span className="font-medium">{type.name}</span>
                  </div>
                </Td>
                <Td className="font-mono text-xs">{type.code}</Td>
                <Td>{type.daysPerYear}</Td>
                <Td>{type.paid ? 'Paid' : 'Unpaid'}</Td>
                <Td>
                  {type.carryForward
                    ? `Up to ${type.maxCarryForwardDays ?? '—'} day(s)`
                    : 'No'}
                </Td>
                <Td>{type.requiresApproval ? 'Required' : 'Auto-approved'}</Td>
                <Td>
                  <Badge className={type.isActive ? undefined : 'text-text-muted'}>
                    {type.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {type.isActive && (
                    <button
                      onClick={() => handleDeactivate(type)}
                      title="Deactivate"
                      className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (leaveTypes?.length ?? 0) === 0 && (
          <EmptyState title="No leave types yet" subtitle="Add one to start accepting leave requests." />
        )}

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Add Leave Type"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button loading={createType.isPending} onClick={handleCreate} disabled={!canSubmit}>
                Create Leave Type
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrap label="Name" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Annual Leave" />
            </FieldWrap>
            <FieldWrap label="Code" required hint="Short unique code, e.g. ANNUAL">
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ANNUAL" />
            </FieldWrap>
            <FieldWrap label="Days per Year">
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.daysPerYear}
                onChange={(e) => setForm((f) => ({ ...f, daysPerYear: e.target.value }))}
              />
            </FieldWrap>
            <FieldWrap label="Color">
              <Input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
            </FieldWrap>
            <FieldWrap label="Paid">
              <Select
                value={form.paid ? 'yes' : 'no'}
                onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value === 'yes' }))}
              >
                <option value="yes">Paid</option>
                <option value="no">Unpaid</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Requires Approval">
              <Select
                value={form.requiresApproval ? 'yes' : 'no'}
                onChange={(e) => setForm((f) => ({ ...f, requiresApproval: e.target.value === 'yes' }))}
              >
                <option value="yes">Requires approval</option>
                <option value="no">Auto-approved</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Carry Forward">
              <Select
                value={form.carryForward ? 'yes' : 'no'}
                onChange={(e) => setForm((f) => ({ ...f, carryForward: e.target.value === 'yes' }))}
              >
                <option value="no">Does not carry forward</option>
                <option value="yes">Carries forward</option>
              </Select>
            </FieldWrap>
            {form.carryForward && (
              <FieldWrap label="Max Carry-Forward Days">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.maxCarryForwardDays}
                  onChange={(e) => setForm((f) => ({ ...f, maxCarryForwardDays: e.target.value }))}
                />
              </FieldWrap>
            )}
          </div>
        </Modal>
      </Card>
    </ProgramWorkspace>
  );
}
