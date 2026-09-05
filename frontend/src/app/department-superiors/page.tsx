'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, UserCog, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import {
  useDepartmentSuperiors,
  useCreateDepartmentSuperior,
  useDeleteDepartmentSuperior,
} from '@/hooks/useDepartmentSuperiors';
import { useDepartments } from '@/hooks/useDepartments';
import { useSubDepartments } from '@/hooks/useSubDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';

const EMPTY_FORM = { title: '', departmentId: '', subDepartmentId: '', employeeId: '' };

export default function DepartmentSuperiorsPage() {
  const { data, isLoading } = useDepartmentSuperiors();
  const { data: departments } = useDepartments();
  const { data: subDepartments } = useSubDepartments();
  const { data: employeesData } = useEmployees({ pageSize: 500 });
  const createAssignment = useCreateDepartmentSuperior();
  const deleteAssignment = useDeleteDepartmentSuperior();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.departmentId && !form.subDepartmentId) {
      toast.error('Select a department or sub-department');
      return;
    }
    try {
      await createAssignment.mutateAsync({
        title: form.title,
        departmentId: form.departmentId || undefined,
        subDepartmentId: form.subDepartmentId || undefined,
        employeeId: form.employeeId,
      });
      toast.success('Superior assigned');
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Remove assignment "${label}"?`)) return;
    try {
      await deleteAssignment.mutateAsync(id);
      toast.success('Assignment removed');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Department Superiors" subtitle="Assign heads / superiors over departments and sub-departments">
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} assignments</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Assign Superior
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Title</Th>
              <Th>Unit</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((a) => (
              <Tr key={a.id}>
                <Td className="font-medium">
                  {a.employee?.fullName} <span className="text-text-muted">({a.employee?.employeeCode})</span>
                </Td>
                <Td>
                  <Badge>{a.title}</Badge>
                </Td>
                <Td>{a.department?.name ?? a.subDepartment?.name ?? '—'}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleDelete(a.id, `${a.employee?.fullName} - ${a.title}`)}
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
          <EmptyState icon={<UserCog className="h-8 w-8" />} title="No superior assignments yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign Superior"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="superior-form" loading={createAssignment.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="superior-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldWrap label="Employee" required>
              <Select value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} required>
                <option value="">Select employee</option>
                {employeesData?.items.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </Select>
            </FieldWrap>
          </div>
          <div className="sm:col-span-2">
            <FieldWrap label="Title" required hint="e.g. Head of Department, In-Charge">
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </FieldWrap>
          </div>
          <FieldWrap label="Department" hint="Set this or Sub-Department">
            <Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">None</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Sub-Department" hint="Set this or Department">
            <Select value={form.subDepartmentId} onChange={(e) => set('subDepartmentId', e.target.value)}>
              <option value="">None</option>
              {subDepartments?.map((sd) => (
                <option key={sd.id} value={sd.id}>
                  {sd.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </form>
      </Modal>
    </AppShell>
  );
}
