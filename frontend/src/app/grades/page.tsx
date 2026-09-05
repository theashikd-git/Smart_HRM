'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { useGrades, useCreateGrade, useUpdateGrade, useDeleteGrade } from '@/hooks/useGrades';
import { apiErrorMessage } from '@/lib/api';
import { Grade } from '@/types';

const EMPTY_FORM = { name: '', level: '', minSalary: '', maxSalary: '', benefits: '', status: 'ACTIVE' };

export default function GradesPage() {
  const { data, isLoading } = useGrades();
  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();
  const deleteGrade = useDeleteGrade();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(g: Grade) {
    setEditing(g);
    setForm({
      name: g.name,
      level: g.level != null ? String(g.level) : '',
      minSalary: g.minSalary != null ? String(g.minSalary) : '',
      maxSalary: g.maxSalary != null ? String(g.maxSalary) : '',
      benefits: g.benefits ?? '',
      status: g.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      level: form.level ? Number(form.level) : undefined,
      minSalary: form.minSalary ? Number(form.minSalary) : undefined,
      maxSalary: form.maxSalary ? Number(form.maxSalary) : undefined,
      benefits: form.benefits || undefined,
      status: form.status,
    };
    try {
      if (editing) {
        await updateGrade.mutateAsync({ id: editing.id, ...payload });
        toast.success('Grade updated');
      } else {
        await createGrade.mutateAsync(payload);
        toast.success('Grade created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(g: Grade) {
    if (!confirm(`Delete grade "${g.name}"?`)) return;
    try {
      await deleteGrade.mutateAsync(g.id);
      toast.success('Grade deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Grades" subtitle="Salary grades / bands used across designations">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} grades</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Grade
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Grade</Th>
              <Th>Level</Th>
              <Th>Salary Range</Th>
              <Th>Status</Th>
              <Th>Designations</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((g) => (
              <Tr key={g.id}>
                <Td className="font-medium">{g.name}</Td>
                <Td>{g.level ?? '—'}</Td>
                <Td>
                  {g.minSalary != null || g.maxSalary != null
                    ? `${g.minSalary?.toLocaleString() ?? '—'} - ${g.maxSalary?.toLocaleString() ?? '—'}`
                    : '—'}
                </Td>
                <Td>
                  <Badge className={g.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>
                    {g.status}
                  </Badge>
                </Td>
                <Td>{g._count?.designations ?? 0}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(g)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(g)}
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
          <EmptyState icon={<Layers className="h-8 w-8" />} title="No grades yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Grade' : 'Add Grade'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="grade-form" loading={createGrade.isPending || updateGrade.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="grade-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrap label="Grade Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </FieldWrap>
          <FieldWrap label="Level" hint="Numeric rank, e.g. 1 = highest">
            <Input type="number" value={form.level} onChange={(e) => set('level', e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Min Salary">
            <Input type="number" value={form.minSalary} onChange={(e) => set('minSalary', e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Max Salary">
            <Input type="number" value={form.maxSalary} onChange={(e) => set('maxSalary', e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FieldWrap>
          <div className="sm:col-span-2">
            <FieldWrap label="Benefits">
              <Textarea value={form.benefits} onChange={(e) => set('benefits', e.target.value)} />
            </FieldWrap>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
