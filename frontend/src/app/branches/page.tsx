'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, GitBranch, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from '@/hooks/useBranches';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';
import { Branch } from '@/types';

const EMPTY_FORM = { name: '', code: '', address: '', managerId: '', status: 'ACTIVE' };

export default function BranchesPage() {
  const { data, isLoading } = useBranches();
  const { data: employeesData } = useEmployees({ pageSize: 500 });
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code ?? '',
      address: b.address ?? '',
      managerId: b.managerId ?? '',
      status: b.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code || undefined,
      address: form.address || undefined,
      managerId: form.managerId || undefined,
      status: form.status,
    };
    try {
      if (editing) {
        await updateBranch.mutateAsync({ id: editing.id, ...payload });
        toast.success('Branch updated');
      } else {
        await createBranch.mutateAsync(payload);
        toast.success('Branch created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(b: Branch) {
    if (!confirm(`Delete branch "${b.name}"?`)) return;
    try {
      await deleteBranch.mutateAsync(b.id);
      toast.success('Branch deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Branches" subtitle="Company branches / offices across locations">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} branches</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Branch
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Branch</Th>
              <Th>Code</Th>
              <Th>Manager</Th>
              <Th>Status</Th>
              <Th>Employees</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((b) => (
              <Tr key={b.id}>
                <Td className="font-medium">{b.name}</Td>
                <Td>{b.code ? <Badge className="font-mono">{b.code}</Badge> : '—'}</Td>
                <Td>{b.manager?.fullName ?? '—'}</Td>
                <Td>
                  <Badge className={b.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>
                    {b.status}
                  </Badge>
                </Td>
                <Td>{b._count?.employees ?? 0}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(b)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (data?.length ?? 0) === 0 && (
          <EmptyState icon={<GitBranch className="h-8 w-8" />} title="No branches yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Branch' : 'Add Branch'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="branch-form" loading={createBranch.isPending || updateBranch.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="branch-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrap label="Branch Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </FieldWrap>
          <FieldWrap label="Code" required hint="Short unique code">
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required />
          </FieldWrap>
          <FieldWrap label="Manager">
            <Select value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
              <option value="">Unassigned</option>
              {employeesData?.items.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FieldWrap>
          <div className="sm:col-span-2">
            <FieldWrap label="Address">
              <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} />
            </FieldWrap>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
