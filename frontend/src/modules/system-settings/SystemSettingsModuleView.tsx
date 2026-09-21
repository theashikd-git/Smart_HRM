'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Card, CardHeader, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { apiErrorMessage } from '@/lib/api';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/hooks/useUsers';
import { useEmployees } from '@/hooks/useEmployees';
import type { SystemUser } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGING_DIRECTOR: 'Managing Director',
  HR: 'HR Officer',
  MANAGER: 'Manager',
  SUPERVISOR: 'Supervisor',
  EMPLOYEE: 'Employee (self-service)',
};

// Add Staff User always collects a real username/password, for every
// role -- Employee ID logins (including Manager/Supervisor/Managing
// Director access) are granted from the Add/Edit Employee form's Employee
// Role field instead (see backend UsersService.EMPLOYEE_ID_LOGIN_ROLES).
// Role alone can't tell the two apart here (a Manager might be either
// kind), so this table tells them apart by the synthetic placeholder email
// an Employee ID login gets (see backend UsersService.create) -- a real
// username never matches that pattern.
const EMPLOYEE_LOGIN_EMAIL_SUFFIX = '@employee.smarthrm.local';
function isEmployeeIdLogin(u: { username: string }): boolean {
  return u.username.endsWith(EMPLOYEE_LOGIN_EMAIL_SUFFIX);
}

const STAFF_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
  { value: 'HR', label: 'HR Officer' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
];

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

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const canSubmit = !!form.username && !!form.fullName && form.password.length >= 6;

  // Searchable by name or Employee ID -- for the "Link to Employee" field,
  // optionally tying a staff account to its Employee record so that person
  // is findable by Employee ID elsewhere (e.g. picking a leave approval
  // tier's approver).
  const employeeOptions = (employees?.items ?? []).map((emp) => ({
    id: emp.id,
    label: emp.fullName,
    sublabel: emp.employeeCode,
  }));

  const filteredUsers = (users ?? []).filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.employee?.employeeCode ?? '').toLowerCase().includes(q) ||
      (u.employee?.fullName ?? '').toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    try {
      // Add Staff User always creates a traditional username/password
      // login, whatever the role -- Manager/Supervisor/Managing Director
      // access via Employee ID is granted from Add/Edit Employee instead.
      await createUser.mutateAsync({
        role: form.role as any,
        username: form.username,
        fullName: form.fullName,
        password: form.password,
        employeeId: form.employeeId || undefined,
      });
      toast.success('Staff user created');
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
        // Role is editable regardless of login type -- this updates the
        // Role on whatever login this account already has (staff username
        // or Employee ID), it never converts one into the other. Changing
        // Role for an Employee ID login is normally done from Add/Edit
        // Employee's Employee Role field instead, which keeps that field
        // and this account's Role in step; editing it here directly is
        // still possible for edge cases (see the "Link to Employee" hint
        // below), it just won't update that Employee Role label to match.
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
        subtitle="Every login account -- staff accounts made here, and Employee ID logins made from Add/Edit Employee"
        action={
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setModalOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Staff User
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, username, or Employee ID…"
          className="h-8 max-w-xs text-xs"
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 w-auto max-w-[170px] text-xs"
        >
          <option value="ALL">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {(search || roleFilter !== 'ALL') && (
          <span className="text-xs text-text-muted">
            {filteredUsers.length} of {users?.length ?? 0}
          </span>
        )}
      </div>
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
          {filteredUsers.map((u) => (
            <Tr key={u.id}>
              <Td className="font-medium">{u.fullName}</Td>
              <Td className="text-xs font-mono">
                {isEmployeeIdLogin(u) ? u.employee?.employeeCode ?? '—' : u.username}
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
        <EmptyState title="No system users yet" subtitle="Add the first staff account to get started." />
      )}
      {!isLoading && (users?.length ?? 0) > 0 && filteredUsers.length === 0 && (
        <EmptyState title="No matching users" subtitle="Try a different search term or role filter." />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Staff User"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={createUser.isPending} onClick={handleCreate} disabled={!canSubmit}>
              Create Staff User
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrap label="Role" required>
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {STAFF_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FieldWrap>

          <FieldWrap label="Full Name" required>
            <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </FieldWrap>
          <FieldWrap label="Username" required>
            <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
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
            hint="Optional -- ties this login to their Employee record, so they're findable by Employee ID (e.g. when picking a leave approval tier's approver). They'll still sign in with this username, not their Employee ID."
          >
            <SearchSelect
              value={form.employeeId}
              onChange={(id) => setForm((f) => ({ ...f, employeeId: id }))}
              options={employeeOptions}
              placeholder="Search employee ID or name (optional)"
              searchPlaceholder="Type an employee ID or name…"
            />
          </FieldWrap>
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
                <option value="MANAGING_DIRECTOR">Managing Director</option>
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
                isEmployeeIdLogin(editingUser)
                  ? 'This is how they sign in with their Employee ID -- leave it as-is. To change their role, use Employee Role on the Add/Edit Employee form instead.'
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
        {/* Company Profile moved to Personnel > Organization > Company --
            see CompanyProgram.tsx -- System Settings is now just accounts. */}
        <p className="text-xs text-text-secondary">System user accounts</p>
      </div>
      <UserManagement />
    </div>
  );
}
