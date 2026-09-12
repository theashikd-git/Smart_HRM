'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Card, CardHeader, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { api, apiErrorMessage } from '@/lib/api';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/hooks/useUsers';
import { useEmployees } from '@/hooks/useEmployees';
import type { SystemUser } from '@/types';

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

const EMPTY_FORM = { role: 'HR' as string, username: '', fullName: '', password: '', employeeId: '' };
const EMPTY_EDIT_FORM = { fullName: '', role: 'HR' as string, isActive: true, password: '', employeeId: '' };

function UserManagement() {
  const { data: users, isLoading } = useUsers();
  const { data: employees } = useEmployees({ pageSize: 200 });
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const isEmployeeAccount = form.role === 'EMPLOYEE';
  const selectedEmployee = employees?.items.find((e) => e.id === form.employeeId);
  const canSubmit = isEmployeeAccount
    ? !!form.employeeId
    : !!form.username && !!form.fullName && form.password.length >= 6;

  // Searchable by name or Employee ID -- used both for the "Add User" form's
  // Employee picker and the "Link to Employee" field so a staff account can
  // be tied to its Employee record (which is what makes that person findable
  // by Employee ID elsewhere, e.g. picking a leave approval tier's approver).
  const employeeOptions = (employees?.items ?? []).map((emp) => ({
    id: emp.id,
    label: emp.fullName,
    sublabel: emp.employeeCode,
  }));

  async function handleCreate() {
    try {
      await createUser.mutateAsync(
        isEmployeeAccount
          ? { role: 'EMPLOYEE', employeeId: form.employeeId }
          : {
              role: form.role as any,
              username: form.username,
              fullName: form.fullName,
              password: form.password,
              employeeId: form.employeeId || undefined,
            },
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

  function openEdit(u: SystemUser) {
    setEditingUser(u);
    setEditForm({
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      password: '',
      employeeId: u.employeeId ?? '',
    });
  }

  async function handleUpdate() {
    if (!editingUser) return;
    try {
      await updateUser.mutateAsync({
        id: editingUser.id,
        fullName: editForm.fullName,
        role: editForm.role,
        isActive: editForm.isActive,
        ...(editForm.password ? { password: editForm.password } : {}),
        // Role and the Employee link are both editable regardless of the
        // account's current role -- this is how an existing self-service
        // (EMPLOYEE) login gets promoted to a staff role (e.g. Manager) so
        // that same person becomes pickable as a leave approver, without
        // having to create a second account for them (an Employee can only
        // ever be linked to one login).
        employeeId: editForm.employeeId,
      });
      toast.success('User updated');
      setEditingUser(null);
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
                {u.role === 'EMPLOYEE' ? u.employee?.employeeCode ?? '—' : u.username}
              </Td>
              <Td>
                <Badge>{ROLE_LABELS[u.role] ?? u.role}</Badge>
              </Td>
              <Td className="text-xs text-text-secondary">
                {u.employee ? `${u.employee.fullName} (${u.employee.employeeCode})` : '—'}
              </Td>
              <Td className="text-xs">{u.isActive ? 'Active' : 'Inactive'}</Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => openEdit(u)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(u.id, u.fullName)}
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
              <SearchSelect
                value={form.employeeId}
                onChange={(id) => setForm((f) => ({ ...f, employeeId: id }))}
                options={employeeOptions}
                placeholder="Search employee ID or name"
                searchPlaceholder="Type an employee ID or name…"
              />
            </FieldWrap>
          ) : (
            <>
              <FieldWrap label="Full Name" required>
                <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
              </FieldWrap>
              <FieldWrap label="Username" required>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </FieldWrap>
              <FieldWrap label="Password" required hint="Minimum 6 characters">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </FieldWrap>
              <FieldWrap
                label="Link to Employee"
                hint="Optional -- ties this login to their Employee record, so they're findable by Employee ID (e.g. when picking a leave approval tier's approver)."
              >
                <SearchSelect
                  value={form.employeeId}
                  onChange={(id) => setForm((f) => ({ ...f, employeeId: id }))}
                  options={employeeOptions}
                  placeholder="Search employee ID or name (optional)"
                  searchPlaceholder="Type an employee ID or name…"
                />
              </FieldWrap>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit ${editingUser?.fullName ?? 'User'}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button loading={updateUser.isPending} onClick={handleUpdate}>
              Save Changes
            </Button>
          </>
        }
      >
        {editingUser && (
          <div className="space-y-4">
            <FieldWrap label="Full Name" required>
              <Input value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} />
            </FieldWrap>

            <FieldWrap label="Role" required>
              <Select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="ADMIN">Administrator</option>
                <option value="HR">HR Officer</option>
                <option value="MANAGER">Manager</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="EMPLOYEE">Employee (self-service)</option>
              </Select>
            </FieldWrap>

            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-line"
              />
              Active
            </label>

            <FieldWrap label="New Password" hint="Leave blank to keep the current password">
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              />
            </FieldWrap>

            <FieldWrap
              label="Link to Employee"
              hint={
                editForm.role === 'EMPLOYEE'
                  ? 'Required for a self-service login -- this is how they sign in with their Employee ID. Leave it as-is.'
                  : "Optional -- ties this login to their Employee record, so they're findable by Employee ID (e.g. when picking a leave approval tier's approver)."
              }
            >
              <SearchSelect
                value={editForm.employeeId}
                onChange={(id) => setEditForm((f) => ({ ...f, employeeId: id }))}
                options={employeeOptions}
                placeholder="Search employee ID or name (optional)"
                searchPlaceholder="Type an employee ID or name…"
              />
            </FieldWrap>
          </div>
        )}
      </Modal>
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
        <p className="text-xs text-text-secondary">Company profile and system user accounts</p>
      </div>
      <CompanySettings />
      <UserManagement />
    </div>
  );
}
