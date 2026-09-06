'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowUp, ArrowDown, GitBranch, Save } from 'lucide-react';
import { Card, CardHeader, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { api, apiErrorMessage } from '@/lib/api';
import { useUsers, useCreateUser, useDeleteUser } from '@/hooks/useUsers';
import { useEmployees } from '@/hooks/useEmployees';
import { useLeaveWorkflows, useSaveLeaveWorkflow, useDeleteLeaveWorkflow } from '@/hooks/useLeaveWorkflows';
import { LeaveApprovalTier, LeaveTierType } from '@/types';

function CompanySettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get('/company')).data,
  });
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    timeZone: '',
    officeHours: '',
    workingDays: '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        timeZone: data.timeZone || '',
        officeHours: data.officeHours || '',
        workingDays: data.workingDays || '',
      });
    }
  }, [data]);

  const update = useMutation({
    mutationFn: async () => (await api.patch('/company', form)).data,
    onSuccess: () => {
      toast.success('Company profile updated');
      qc.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Card>
      <CardHeader title="Company Profile" subtitle="Shown across reports and the login screen" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5"
      >
        <FieldWrap label="Company Name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Time Zone">
          <Input value={form.timeZone} onChange={(e) => set('timeZone', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Phone">
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Email">
          <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Website">
          <Input value={form.website} onChange={(e) => set('website', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Office Hours">
          <Input value={form.officeHours} onChange={(e) => set('officeHours', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Working Days" hint="Comma separated, e.g. Sun,Mon,Tue,Wed,Thu">
          <Input value={form.workingDays} onChange={(e) => set('workingDays', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Address">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </FieldWrap>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" loading={update.isPending}>
            Save Company Profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  HR: 'HR Officer',
  MANAGER: 'Manager',
  SUPERVISOR: 'Supervisor',
  EMPLOYEE: 'Employee (self-service)',
};

const EMPTY_FORM = { role: 'HR' as string, email: '', fullName: '', password: '', employeeId: '' };

function UserManagement() {
  const { data: users, isLoading } = useUsers();
  const { data: employees } = useEmployees({ pageSize: 200 });
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const isEmployeeAccount = form.role === 'EMPLOYEE';
  const selectedEmployee = employees?.items.find((e) => e.id === form.employeeId);
  const canSubmit = isEmployeeAccount
    ? !!form.employeeId
    : !!form.email && !!form.fullName && form.password.length >= 6;

  async function handleCreate() {
    try {
      await createUser.mutateAsync(
        isEmployeeAccount
          ? { role: 'EMPLOYEE', employeeId: form.employeeId }
          : { role: form.role as any, email: form.email, fullName: form.fullName, password: form.password },
      );
      if (isEmployeeAccount && selectedEmployee) {
        toast.success(
          `Login created for ${selectedEmployee.fullName}. Employee ID and password are both "${selectedEmployee.employeeCode}".`,
          { duration: 8000 },
        );
      } else {
        toast.success('User created');
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    try {
      await deleteUser.mutateAsync(id);
      toast.success('User removed');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader
        title="System Users"
        subtitle="Staff accounts (Administrator, HR, Manager) and employee self-service logins"
        action={
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setModalOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add User
          </Button>
        }
      />
      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Login</Th>
            <Th>Role</Th>
            <Th>Linked Employee</Th>
            <Th>Status</Th>
            <Th></Th>
          </tr>
        </Thead>
        <Tbody>
          {users?.map((u) => (
            <Tr key={u.id}>
              <Td className="font-medium">{u.fullName}</Td>
              <Td className="text-xs font-mono">
                {u.role === 'EMPLOYEE' ? u.employee?.employeeCode ?? '—' : u.email}
              </Td>
              <Td>
                <Badge>{ROLE_LABELS[u.role] ?? u.role}</Badge>
              </Td>
              <Td className="text-xs text-text-secondary">
                {u.employee ? `${u.employee.fullName} (${u.employee.employeeCode})` : '—'}
              </Td>
              <Td className="text-xs">{u.isActive ? 'Active' : 'Inactive'}</Td>
              <Td className="text-right">
                <button
                  onClick={() => handleDelete(u.id, u.fullName)}
                  className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {!isLoading && (users?.length ?? 0) === 0 && (
        <EmptyState title="No system users yet" subtitle="Add the first account to get started." />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add System User"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={createUser.isPending} onClick={handleCreate} disabled={!canSubmit}>
              Create User
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrap label="Role" required>
            <Select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...EMPTY_FORM, role: e.target.value }))}
            >
              <option value="ADMIN">Administrator</option>
              <option value="HR">HR Officer</option>
              <option value="MANAGER">Manager</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="EMPLOYEE">Employee (self-service)</option>
            </Select>
          </FieldWrap>

          {isEmployeeAccount ? (
            <FieldWrap
              label="Employee"
              required
              hint="Login and default password will both be this employee's Employee ID."
            >
              <Select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Select employee</option>
                {employees?.items.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </Select>
            </FieldWrap>
          ) : (
            <>
              <FieldWrap label="Full Name" required>
                <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
              </FieldWrap>
              <FieldWrap label="Email" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </FieldWrap>
              <FieldWrap label="Password" required hint="Minimum 6 characters">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </FieldWrap>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
}

// -- Leave Approval Workflows ("tiers") --------------------------------------

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

function LeaveWorkflowSettings() {
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
    <Card className="mt-4">
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
  );
}

/**
 * Root view for the ADMIN-only "System Settings" top-level module (see
 * TopNavigation's MODULES list). Same single-screen shape as Leave --
 * no sidebar or Workbench tabs of its own.
 */
export function SystemSettingsModuleView() {
  return (
    <div className="h-full overflow-auto bg-surface p-4">
      <div className="mb-4">
        <h1 className="text-[15px] font-semibold text-text-primary">System Settings</h1>
        <p className="text-xs text-text-secondary">Company profile, system user accounts, and leave approval chains</p>
      </div>
      <CompanySettings />
      <UserManagement />
      <LeaveWorkflowSettings />
    </div>
  );
}
