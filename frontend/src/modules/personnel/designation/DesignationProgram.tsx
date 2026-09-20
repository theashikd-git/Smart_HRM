'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, IdCard } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { useDesignations, useDeleteDesignation } from '@/hooks/useDesignations';
import { apiErrorMessage } from '@/lib/api';
import { AddDesignationModal } from './AddDesignationModal';
import { EditDesignationModal } from './EditDesignationModal';
import type { Designation } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

/** Designation list -- job titles, each optionally tied to a department. */
export function DesignationProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: designations, isLoading } = useDesignations();
  const deleteDesignation = useDeleteDesignation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);

  async function handleDelete(designation: Designation) {
    if (!confirm(`Permanently delete "${designation.title}"?`)) return;
    try {
      await deleteDesignation.mutateAsync(designation.id);
      toast.success('Designation deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Designation
        </Button>
      }
    >
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Designation</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th className="text-right">Employees</Th>
              <Th className="w-20"></Th>
            </tr>
          </Thead>
          <Tbody>
            {designations?.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <span className="flex items-center gap-2 font-medium text-text-primary">
                    <IdCard className="h-3.5 w-3.5 text-text-muted" />
                    {d.title}
                  </span>
                </Td>
                <Td>{d.department?.name ?? '—'}</Td>
                <Td>
                  <Badge className={d.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>{d.status}</Badge>
                </Td>
                <Td className="text-right">{d._count?.employees ?? 0}</Td>
                <Td>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setEditing(d)}
                      title="Edit designation"
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      title="Delete designation"
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

        {!isLoading && (designations?.length ?? 0) === 0 && (
          <EmptyState icon={<IdCard className="h-8 w-8" />} title="No designations yet" subtitle="Add your first designation to get started." />
        )}
      </Card>

      <AddDesignationModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <EditDesignationModal open={!!editing} onClose={() => setEditing(null)} designation={editing} />
    </ProgramWorkspace>
  );
}
