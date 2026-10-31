'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Search, UserX, CheckCircle2 } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useEmployees, useActivateEmployee } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { formatDate } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api';
import type { WorkbenchTab } from '@/types/workbench';

/**
 * Personnel > Resigned Employees -- real data now, not the old mock
 * placeholder. Just the normal employee list (useEmployees) pinned to
 * status=RESIGNED, same endpoint and filters the Employee List itself
 * uses, so marking someone resigned from their profile (see
 * EmployeeStatusToggle / ResignEmployeeModal) is all it takes for them to
 * show up here. "Reinstate" reuses activate() -- see EmployeesService
 * .activate, which also clears the resignation date/reason.
 */
export function ResignedEmployeesProgram({ tab }: { tab: WorkbenchTab }) {
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useEmployees({
    search: search || undefined,
    departmentId: departmentId || undefined,
    status: 'RESIGNED',
    page,
    pageSize: 10,
  });
  const { data: departments } = useDepartments();
  const activateEmployee = useActivateEmployee();

  async function handleReinstate(id: string, name: string) {
    try {
      await activateEmployee.mutateAsync(id);
      toast.success(`${name} reinstated`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace title={tab.title} breadcrumb={tab.breadcrumb}>
      <div className="flex h-full flex-col gap-4 overflow-auto p-4">
        <Card>
          <div className="flex flex-col gap-3 p-4 border-b border-line sm:flex-row sm:items-center">
            <div className="relative shrink-0 sm:w-64">
              <span className="pointer-events-none absolute left-3 top-0 bottom-0 flex items-center">
                <Search className="h-3.5 w-3.5 text-text-muted" />
              </span>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, code, email, phone..."
                className="pl-9"
              />
            </div>
            <div className="shrink-0 sm:w-44">
              <Select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Departments</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Table>
            <Thead>
              <tr>
                <Th>Employee ID</Th>
                <Th>Name</Th>
                <Th>Department</Th>
                <Th>Last Working Day</Th>
                <Th>Reason</Th>
                <Th className="text-center w-28">Action</Th>
              </tr>
            </Thead>
            <Tbody>
              {data?.items.map((emp) => (
                <Tr key={emp.id}>
                  <Td className="font-mono text-xs text-text-muted">{emp.employeeCode}</Td>
                  <Td className="font-medium text-text-primary">{emp.fullName}</Td>
                  <Td>{emp.department?.name || '—'}</Td>
                  <Td>{formatDate(emp.resignationDate)}</Td>
                  <Td>{emp.resignationReason || '—'}</Td>
                  <Td className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReinstate(emp.id, emp.fullName)}
                      loading={activateEmployee.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Reinstate
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {!isLoading && (data?.items.length ?? 0) === 0 && (
            <EmptyState
              icon={<UserX className="h-8 w-8" />}
              title="No resigned employees"
              subtitle="Employees marked as resigned from their profile will show up here."
            />
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-line">
              <p className="text-xs text-text-secondary">
                Page {data.page} of {data.totalPages} &middot; {data.total} resigned employee(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </ProgramWorkspace>
  );
}
