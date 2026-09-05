'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '@/hooks/useDepartments';
import { useBranches } from '@/hooks/useBranches';
import { useLocations } from '@/hooks/useLocations';
import { apiErrorMessage } from '@/lib/api';
import { Department } from '@/types';

const EMPTY_FORM = { name: '', code: '', branchId: '', locationId: '', status: 'ACTIVE' };

export default function DepartmentsPage() {
  const { data, isLoading } = useDepartments();
  const { data: branches } = useBranches();
  const { data: locations } = useLocations();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setForm({
      name: d.name,
      code: d.code,
      branchId: d.branchId ?? '',
      locationId: d.locationId ?? '',
      status: d.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code,
      branchId: form.branchId || undefined,
      locationId: form.locationId || undefined,
      status: form.status,
    };
    try {
      if (editing) {
        await updateDept.mutateAsync({ id: editing.id, ...payload });
        toast.success('Department updated');
      } else {
        await createDept.mutateAsync(payload);
        toast.success('Department created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(d: Department) {
    if (!confirm(`Delete department "${d.name}"?`)) return;
    try {
      await deleteDept.mutateAsync(d.id);
      toast.success('Department deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Departments" subtitle="Organize employees into business units">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} departments</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Department
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Department</Th>
              <Th>Code</Th>
              <Th>Branch</Th>
              <Th>Location</Th>
              <Th>Status</Th>
              <Th>Employees</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium">{d.name}</Td>
                <Td>
                  <Badge className="font-mono">{d.code}</Badge>
                </Td>
                <Td>{d.branch?.name ?? '—'}</Td>
                <Td>{d.location?.name ?? '—'}</Td>
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
          <EmptyState icon={<Building2 className="h-8 w-8" />} title="No departments yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Department' : 'Add Department'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="dept-form" loading={createDept.isPending || updateDept.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="dept-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrap label="Department Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </FieldWrap>
          <FieldWrap label="Code" required hint="Short unique code, e.g. HR, IT, SLS">
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required />
          </FieldWrap>
          <FieldWrap label="Branch">
            <Select value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>
              <option value="">Unassigned</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Location">
            <Select value={form.locationId} onChange={(e) => set('locationId', e.target.value)}>
              <option value="">Unassigned</option>
              {locations?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
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
