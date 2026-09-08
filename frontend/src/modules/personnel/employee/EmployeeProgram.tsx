'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  Clock,
  DownloadCloud,
  Loader2,
} from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { EmployeeFormModal } from '@/components/employees/EmployeeFormModal';
import { EmployeeProfileContent } from '@/components/employees/EmployeeProfileContent';
import { AttendanceHistoryModal } from '@/components/employees/AttendanceHistoryModal';
import { useEmployees, useEmployee, useDeleteEmployee } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useDevices, useImportDeviceUsers } from '@/hooks/useDevices';
import { formatDate } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import type { Employee } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

export function EmployeeProgram({ tab }: { tab: WorkbenchTab }) {
  const setInternalTab = useWorkbenchStore((s) => s.setInternalTab);
  const program = PROGRAM_REGISTRY.employee;
  const activeInternalTab = tab.activeInternalTab ?? program.defaultInternalTab!;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  function goToProfile(id: string) {
    setSelectedEmployeeId(id);
    setInternalTab(tab.key, 'profile');
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      internalTabs={program.internalTabs}
      activeInternalTab={activeInternalTab}
      onInternalTabChange={(tabId) => setInternalTab(tab.key, tabId)}
    >
      {activeInternalTab === 'list' && <EmployeeListTab onViewEmployee={goToProfile} />}
      {activeInternalTab === 'profile' && <EmployeeProfileTab employeeId={selectedEmployeeId} />}
      {activeInternalTab === 'documents' && <EmployeeDocumentsTab employeeId={selectedEmployeeId} />}
      {activeInternalTab === 'history' && <EmployeeHistoryTab employeeId={selectedEmployeeId} />}
    </ProgramWorkspace>
  );
}

// ---------------------------------------------------------------------------
// Employee List — real API, ported from the legacy /employees page.
// ---------------------------------------------------------------------------

function EmployeeListTab({ onViewEmployee }: { onViewEmployee: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<Employee | null>(null);

  const { data, isLoading } = useEmployees({
    search: search || undefined,
    departmentId: departmentId || undefined,
    status: status || undefined,
    page,
    pageSize: 10,
  });
  const { data: departments } = useDepartments();
  const { data: devices } = useDevices();
  const deleteEmployee = useDeleteEmployee();
  const importDeviceUsers = useImportDeviceUsers();
  const primaryDevice = devices?.[0];

  async function handleImportFromDevice() {
    if (!primaryDevice) {
      toast.error('Add a biometric device first (Device page) before importing');
      return;
    }
    try {
      const res = await importDeviceUsers.mutateAsync(primaryDevice.id);
      toast.success(
        `Imported ${res.imported} new employee(s) from the device (${res.skipped} already linked, ${res.total} total on device)`,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setModalOpen(true);
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`Permanently delete ${emp.fullName}? This also removes them from the device.`)) return;
    try {
      await deleteEmployee.mutateAsync(emp.id);
      toast.success('Employee deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 p-4 border-b border-line sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-3.5 w-3.5 text-text-muted" />
              </div>
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
            <Select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="sm:w-44"
            >
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="sm:w-36"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TERMINATED">Terminated</option>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleImportFromDevice} loading={importDeviceUsers.isPending}>
              <DownloadCloud className="h-4 w-4" />
              Import from Device
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Employee ID</Th>
              <Th>First Name</Th>
              <Th>Department</Th>
              <Th>Hired Date</Th>
              <Th>Employee Type</Th>
              <Th className="text-center w-12"></Th>
              <Th className="text-center w-12"></Th>
              <Th className="text-center w-12"></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.items.map((emp) => (
              <Tr key={emp.id}>
                <Td className="font-mono text-xs text-text-muted">{emp.employeeCode}</Td>
                <Td>
                  <button onClick={() => onViewEmployee(emp.id)} className="font-medium text-text-primary hover:text-accent hover:underline text-left">
                    {emp.fullName}
                  </button>
                </Td>
                <Td>{emp.department?.name || '—'}</Td>
                <Td>{formatDate(emp.joiningDate)}</Td>
                <Td>{EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType || '—'}</Td>
                <Td className="text-center">
                  <button
                    onClick={() => setAttendanceFor(emp)}
                    title="Attendance history"
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-accent"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </Td>
                <Td className="text-center">
                  <button
                    onClick={() => openEdit(emp)}
                    title="Edit employee"
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </Td>
                <Td className="text-center">
                  <button
                    onClick={() => handleDelete(emp)}
                    title="Delete employee"
                    className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No employees found"
            subtitle="Try adjusting your filters, or add your first employee to get started."
          />
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-line">
            <p className="text-xs text-text-secondary">
              Page {data.page} of {data.totalPages} &middot; {data.total} employees
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

      <EmployeeFormModal open={modalOpen} onClose={() => setModalOpen(false)} employee={editing} />
      <AttendanceHistoryModal open={!!attendanceFor} onClose={() => setAttendanceFor(null)} employee={attendanceFor} />
    </>
  );
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
};

// ---------------------------------------------------------------------------
// Profile — real API via useEmployee(id), rendered inline instead of a modal.
// ---------------------------------------------------------------------------

function EmployeeProfileTab({ employeeId }: { employeeId: string | null }) {
  const { data: employee, isLoading } = useEmployee(employeeId ?? undefined);

  if (!employeeId) {
    return (
      <div className="rounded border border-line bg-white p-8 text-center text-xs text-text-muted">
        Select an employee from the Employee List to view their profile.
      </div>
    );
  }

  if (isLoading || !employee) {
    return (
      <div className="flex items-center justify-center rounded border border-line bg-white p-8 text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded border border-line bg-white p-5">
      <EmployeeProfileContent employee={employee} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents / History — not yet built on the backend. Honest empty states,
// not mock data, until these are implemented.
// ---------------------------------------------------------------------------

function EmployeeDocumentsTab({ employeeId }: { employeeId: string | null }) {
  return (
    <div className="rounded border border-line bg-white p-8 text-center text-xs text-text-muted">
      {employeeId
        ? 'Document management for this employee has not been built yet.'
        : 'Select an employee from the Employee List first.'}
    </div>
  );
}

function EmployeeHistoryTab({ employeeId }: { employeeId: string | null }) {
  return (
    <div className="rounded border border-line bg-white p-8 text-center text-xs text-text-muted">
      {employeeId
        ? 'Employment history tracking for this employee has not been built yet.'
        : 'Select an employee from the Employee List first.'}
    </div>
  );
}
