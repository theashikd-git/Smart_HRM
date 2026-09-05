'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, IdCard, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import {
  useDesignations,
  useCreateDesignation,
  useUpdateDesignation,
  useDeleteDesignation,
} from '@/hooks/useDesignations';
import { useGrades } from '@/hooks/useGrades';
import { useDepartments } from '@/hooks/useDepartments';
import { apiErrorMessage } from '@/lib/api';
import { Designation } from '@/types';

const EMPTY_FORM = { title: '', gradeId: '', departmentId: '', status: 'ACTIVE' };

export default function DesignationsPage() {
  const { data, isLoading } = useDesignations();
  const { data: grades } = useGrades();
  const { data: departments } = useDepartments();
  const createDesig = useCreateDesignation();
  const updateDesig = useUpdateDesignation();
  const deleteDesig = useDeleteDesignation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(d: Designation) {
    setEditing(d);
    setForm({
      title: d.title,
      gradeId: d.gradeId ?? '',
      departmentId: d.departmentId ?? '',
      status: d.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      gradeId: form.gradeId || undefined,
      departmentId: form.departmentId || undefined,
      status: form.status,
    };
    try {
      if (editing) {
        await updateDesig.mutateAsync({ id: editing.id, ...payload });
        toast.success('Designation updated');
      } else {
        await createDesig.mutateAsync(payload);
        toast.success('Designation created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(d: Designation) {
    if (!confirm(`Delete designation "${d.title}"?`)) return;
    try {
      await deleteDesig.mutateAsync(d.id);
      toast.success('Designation deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Designations" subtitle="Job titles used across the organization">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} designations</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Designation
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Title</Th>
              <Th>Grade</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Employees</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium">{d.title}</Td>
                <Td>{d.grade?.name ?? '—'}</Td>
                <Td>{d.department?.name ?? '—'}</Td>
                <Td>
                  <Badge className={d.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>
                    {d.status}
                  </Badge>
                </Td>
                <Td>{d._count?.employees ?? 0}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(d)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
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
          <EmptyState icon={<IdCard className="h-8 w-8" />} title="No designations yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Designation' : 'Add Designation'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="desig-form" loading={createDesig.isPending || updateDesig.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="desig-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldWrap label="Title" required>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} required autoFocus />
            </FieldWrap>
          </div>
          <FieldWrap label="Grade">
            <Select value={form.gradeId} onChange={(e) => set('gradeId', e.target.value)}>
              <option value="">Unassigned</option>
              {grades?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Department">
            <Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">Unassigned</option>
              {departments?.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
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
