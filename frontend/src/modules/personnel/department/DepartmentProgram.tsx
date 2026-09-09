'use client';

import { Fragment, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Building2, CornerDownRight } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useDepartments, useDeleteDepartment } from '@/hooks/useDepartments';
import { apiErrorMessage } from '@/lib/api';
import { AddDepartmentModal } from './AddDepartmentModal';
import type { Department } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

/**
 * Department list, shown as a tree: each department is a parent row with
 * its sub-departments (created inline with it via the Add Department
 * popup, or added later) nested directly underneath -- matches how a new
 * department and its sub-departments should "instantly appear" together
 * once saved.
 */
export function DepartmentProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: departments, isLoading } = useDepartments();
  const deleteDepartment = useDeleteDepartment();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleDelete(dept: Department) {
    const subCount = dept.subDepartments?.length ?? 0;
    const warning = subCount
      ? ` This also removes its ${subCount} sub-department(s).`
      : '';
    if (!confirm(`Permanently delete ${dept.name}?${warning}`)) return;
    try {
      await deleteDepartment.mutateAsync(dept.id);
      toast.success('Department deleted');
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
          Add Department
        </Button>
      }
    >
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Department</Th>
              <Th>Code</Th>
              <Th>Manager</Th>
              <Th className="text-right">Employees</Th>
              <Th className="w-12"></Th>
            </tr>
          </Thead>
          <Tbody>
            {departments?.map((dept) => (
              <Fragment key={dept.id}>
                <Tr>
                  <Td>
                    <span className="flex items-center gap-2 font-medium text-text-primary">
                      <Building2 className="h-3.5 w-3.5 text-text-muted" />
                      {dept.name}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs text-text-muted">{dept.code}</Td>
                  <Td>{dept.manager?.fullName || '—'}</Td>
                  <Td className="text-right">{dept._count?.employees ?? 0}</Td>
                  <Td className="text-center">
                    <button
                      onClick={() => handleDelete(dept)}
                      title="Delete department"
                      className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Td>
                </Tr>
                {dept.subDepartments?.map((sub) => (
                  <Tr key={sub.id} className="bg-surface-sunken/50">
                    <Td>
                      <span className="flex items-center gap-2 pl-6 text-text-secondary">
                        <CornerDownRight className="h-3.5 w-3.5 text-text-muted" />
                        {sub.name}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs text-text-muted">{sub.code}</Td>
                    <Td>{sub.manager?.fullName || '—'}</Td>
                    <Td className="text-right">{sub._count?.employees ?? 0}</Td>
                    <Td></Td>
                  </Tr>
                ))}
              </Fragment>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (departments?.length ?? 0) === 0 && (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No departments yet"
            subtitle="Add your first department to get started -- you can add its sub-departments in the same step."
          />
        )}
      </Card>

      <AddDepartmentModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </ProgramWorkspace>
  );
}
