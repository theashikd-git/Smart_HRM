'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { useSections, useCreateSection, useUpdateSection, useDeleteSection } from '@/hooks/useSections';
import { useDepartments } from '@/hooks/useDepartments';
import { useSubDepartments } from '@/hooks/useSubDepartments';
import { apiErrorMessage } from '@/lib/api';
import { Section } from '@/types';

const EMPTY_FORM = { name: '', code: '', departmentId: '', subDepartmentId: '', status: 'ACTIVE' };

export default function SectionsPage() {
  const { data, isLoading } = useSections();
  const { data: departments } = useDepartments();
  const { data: subDepartments } = useSubDepartments();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: Section) {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code ?? '',
      departmentId: s.departmentId ?? '',
      subDepartmentId: s.subDepartmentId ?? '',
      status: s.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.departmentId) {
      toast.error('Select a department');
      return;
    }
    const payload = {
      name: form.name,
      code: form.code,
      departmentId: form.departmentId,
      subDepartmentId: form.subDepartmentId || undefined,
      status: form.status,
    };
    try {
      if (editing) {
        await updateSection.mutateAsync({ id: editing.id, ...payload });
        toast.success('Section updated');
      } else {
        await createSection.mutateAsync(payload);
        toast.success('Section created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(s: Section) {
    if (!confirm(`Delete section "${s.name}"?`)) return;
    try {
      await deleteSection.mutateAsync(s.id);
      toast.success('Section deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Sections" subtitle="Teams / sections within departments or sub-departments">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} sections</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Section</Th>
              <Th>Code</Th>
              <Th>Department</Th>
              <Th>Sub-Department</Th>
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
                <Td>{s.subDepartment?.name ?? '—'}</Td>
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
          <EmptyState icon={<LayoutGrid className="h-8 w-8" />} title="No sections yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Section' : 'Add Section'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="section-form"
              loading={createSection.isPending || updateSection.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <form id="section-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrap label="Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </FieldWrap>
          <FieldWrap label="Code" required>
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required />
          </FieldWrap>
          <FieldWrap label="Department" required>
            <Select
              value={form.departmentId}
              onChange={(e) => {
                set('departmentId', e.target.value);
                set('subDepartmentId', '');
              }}
              required
            >
              <option value="">Select department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Sub-Department" hint="Optional, narrows to a sub-department">
            <Select value={form.subDepartmentId} onChange={(e) => set('subDepartmentId', e.target.value)}>
              <option value="">None</option>
              {subDepartments
                ?.filter((sd) => !form.departmentId || sd.departmentId === form.departmentId)
                .map((sd) => (
                  <option key={sd.id} value={sd.id}>
                    {sd.name}
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
