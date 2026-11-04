'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Clock, Pencil, Trash2 } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift, ShiftPayload } from '@/hooks/useShifts';
import { apiErrorMessage } from '@/lib/api';
import { Shift } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const EMPTY: ShiftPayload = {
  name: '',
  startTime: '09:00',
  endTime: '18:00',
  graceMinutes: 10,
  breakMinutes: 60,
  weekendRule: '',
  overtimeRule: '',
};

/**
 * Personnel > Shift -- real CRUD against the same /shifts API the standalone
 * Shifts page (app/shifts) already used, not a mock placeholder. Brought
 * into the Workbench alongside Roster so Shift definitions can be managed
 * from the same program-tab surface as everything else here.
 */
export function ShiftProgram({ tab }: { tab: WorkbenchTab }) {
  const { data, isLoading } = useShifts();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState<ShiftPayload>(EMPTY);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(s: Shift) {
    setEditing(s);
    setForm({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      graceMinutes: s.graceMinutes,
      breakMinutes: s.breakMinutes,
      weekendRule: s.weekendRule || '',
      overtimeRule: s.overtimeRule || '',
    });
    setModalOpen(true);
  }

  function set<K extends keyof ShiftPayload>(key: K, value: ShiftPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await updateShift.mutateAsync({ id: editing.id, ...form });
        toast.success('Shift updated');
      } else {
        await createShift.mutateAsync(form);
        toast.success('Shift created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(s: Shift) {
    if (!confirm(`Delete shift "${s.name}"?`)) return;
    try {
      await deleteShift.mutateAsync(s.id);
      toast.success('Shift deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Shift
        </Button>
      }
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
          <p className="text-xs text-text-muted">{data?.length || 0} shifts</p>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Shift</Th>
              <Th>Hours</Th>
              <Th>Grace</Th>
              <Th>Break</Th>
              <Th>Weekend</Th>
              <Th>Employees</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td className="font-mono text-xs">
                  {s.startTime} – {s.endTime}
                </Td>
                <Td>{s.graceMinutes}m</Td>
                <Td>{s.breakMinutes}m</Td>
                <Td>{s.weekendRule || ''}</Td>
                <Td>{s._count?.employees ?? 0}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      title="Edit shift"
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      title="Delete shift"
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
          <EmptyState icon={<Clock className="h-8 w-8" />} title="No shifts yet" />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Shift' : 'Add Shift'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="shift-program-form" loading={createShift.isPending || updateShift.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="shift-program-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <FieldWrap label="Shift Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required className="col-span-2" />
          </FieldWrap>
          <FieldWrap label="Start Time" required>
            <Input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required />
          </FieldWrap>
          <FieldWrap label="End Time" required>
            <Input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} required />
          </FieldWrap>
          <FieldWrap label="Grace Minutes">
            <Input
              type="number"
              value={form.graceMinutes}
              onChange={(e) => set('graceMinutes', Number(e.target.value))}
            />
          </FieldWrap>
          <FieldWrap label="Break Minutes">
            <Input
              type="number"
              value={form.breakMinutes}
              onChange={(e) => set('breakMinutes', Number(e.target.value))}
            />
          </FieldWrap>
          <FieldWrap label="Weekend Rule" hint="e.g. Fri,Sat">
            <Input value={form.weekendRule} onChange={(e) => set('weekendRule', e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Overtime Rule" hint="e.g. 1.5x after shift end">
            <Input value={form.overtimeRule} onChange={(e) => set('overtimeRule', e.target.value)} />
          </FieldWrap>
        </form>
      </Modal>
    </ProgramWorkspace>
  );
}
