'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Network, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import {
  useSubDepartments,
  useCreateSubDepartment,
  useUpdateSubDepartment,
  useDeleteSubDepartment,
} from '@/hooks/useSubDepartments';
import { useDepartments } from '@/hooks/useDepartments';
import { apiErrorMessage } from '@/lib/api';
import { SubDepartment } from '@/types';

const EMPTY_FORM = { name: '', code: '', departmentId: '', status: 'ACTIVE' };

export default function SubDepartmentsPage() {
  const { data, isLoading } = useSubDepartments();
  const { data: departments } = useDepartments();
  const createSub = useCreateSubDepartment();
  const updateSub = useUpdateSubDepartment();
  const deleteSub = useDeleteSubDepartment();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubDepartment | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: SubDepartment) {
    setEditing(s);
    setForm({ name: s.name, code: s.code ?? '', departmentId: s.departmentId, status: s.status });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code || undefined,
      departmentId: form.departmentId,
      status: form.status,
    };
    try {
      if (editing) {
        await updateSub.mutateAsync({ id: editing.id, ...payload });
        toast.success('Sub-department updated');
      } else {
        await createSub.mutateAsync(payload);
        toast.success('Sub-department created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(s: SubDepartment) {
    if (!confirm(`Delete sub-department "${s.name}"?`)) return;
    try {
      await deleteSub.mutateAsync(s.id);
      toast.success('Sub-department deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Sub-Departments" subtitle="Divisions within a department">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} sub-departments</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Sub-Department
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Sub-Department</Th>
              <Th>Code</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Employees</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td>{s.code ? <Badge className="font-mono">{s.code}</Badge> : '—'}</Td>
                <Td>{s.department?.name ?? '—'}</Td>
                <Td>
                  <Badge className={s.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>
                    {s.status}
                  </Badge>
                </Td>
                <Td>{s._count?.employees ?? 0}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
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
          <EmptyState icon={<Network className="h-8 w-8" />} title="No sub-departments yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Sub-Department' : 'Add Sub-Department'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="subdept-form" loading={createSub.isPending || updateSub.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="subdept-form" onSubmit={handleSubmit} className="space-y-4">
          <FieldWrap label="Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </FieldWrap>
          <FieldWrap label="Code" required>
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required />
          </FieldWrap>
          <FieldWrap label="Department" required>
            <Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} required>
              <option value="">Select department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
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
        </form>
      </Modal>
    </AppShell>
  );
}
