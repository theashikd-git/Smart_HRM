'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Users,
  MoreVertical,
  Pencil,
  Ban,
  CheckCircle2,
  Trash2,
  Fingerprint,
  Scan,
  Eye,
  DownloadCloud,
  Loader2,
} from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { StatusPill } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { EmployeeFormModal } from '@/components/employees/EmployeeFormModal';
import { EmployeeProfileContent } from '@/components/employees/EmployeeProfileContent';
import {
  useEmployees,
  useEmployee,
  useDisableEmployee,
  useActivateEmployee,
  useDeleteEmployee,
} from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useDevices, useImportDeviceUsers } from '@/hooks/useDevices';
import { employeeStatusColors, syncStatusColors } from '@/lib/utils';
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
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const { data, isLoading } = useEmployees({
    search: search || undefined,
    departmentId: departmentId || undefined,
    status: status || undefined,
    page,
    pageSize: 10,
  });
  const { data: departments } = useDepartments();
  const { data: devices } = useDevices();
  const disableEmployee = useDisableEmployee();
  const activateEmployee = useActivateEmployee();
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
    setMenuFor(null);
  }

  function openView(emp: Employee) {
    onViewEmployee(emp.id);
    setMenuFor(null);
  }

  async function handleDisable(emp: Employee) {
    try {
      await disableEmployee.mutateAsync(emp.id);
      toast.success(`${emp.fullName} disabled`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
    setMenuFor(null);
  }

  async function handleActivate(emp: Employee) {
    try {
      await activateEmployee.mutateAsync(emp.id);
      toast.success(`${emp.fullName} activated`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
    setMenuFor(null);
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`Permanently delete ${emp.fullName}? This also removes them from the device.`)) return;
    try {
      await deleteEmployee.mutateAsync(emp.id);
      toast.success('Employee deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
    setMenuFor(null);
  }

  return (
    <>
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-line">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
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
            className="sm:w-48"
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
            className="sm:w-40"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </Select>
          <Button variant="outline" onClick={handleImportFromDevice} loading={importDeviceUsers.isPending}>
            <DownloadCloud className="h-4 w-4" />
            Import from Device
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Designation</Th>
              <Th>Shift</Th>
              <Th>Status</Th>
              <Th>Device Sync</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {data?.items.map((emp) => (
              <Tr key={emp.id}>
                <Td>
                  <button onClick={() => openView(emp)} className="flex items-center gap-3 text-left hover:opacity-80">
                    <Avatar name={emp.fullName} scanFrame />
                    <div>
                      <p className="font-medium text-text-primary">{emp.fullName}</p>
                      <p className="text-xs text-text-muted font-mono">{emp.employeeCode}</p>
                    </div>
                  </button>
                </Td>
                <Td>{emp.department?.name || '—'}</Td>
                <Td>{emp.designation?.title || '—'}</Td>
                <Td>{emp.shift ? `${emp.shift.name}` : '—'}</Td>
                <Td>
                  <StatusPill label={emp.status} colors={employeeStatusColors[emp.status]} />
                </Td>
                <Td>
                  <StatusPill
                    label={emp.syncStatus.replace('_', ' ')}
                    colors={syncStatusColors[emp.syncStatus]}
                    pulsing={emp.syncStatus === 'PENDING'}
                  />
                  {emp.deviceUserId && <p className="mt-1 text-xs font-mono text-text-muted">ID: {emp.deviceUserId}</p>}
                  {(emp.fingerprintEnrolled || emp.faceEnrolled) && (
                    <div className="mt-1 flex items-center gap-2 text-text-muted">
                      {emp.fingerprintEnrolled && (
                        <span title="Fingerprint enrolled" className="flex items-center gap-1 text-xs">
                          <Fingerprint className="h-3 w-3" />
                        </span>
                      )}
                      {emp.faceEnrolled && (
                        <span title="Face enrolled" className="flex items-center gap-1 text-xs">
                          <Scan className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  )}
                </Td>
                <Td className="relative text-right">
                  <button
                    onClick={() => setMenuFor(menuFor === emp.id ? null : emp.id)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuFor === emp.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div className="absolute right-4 z-20 mt-1 w-44 rounded-lg border border-line bg-white shadow-popover py-1 text-left">
                        <button
                          onClick={() => openView(emp)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-sunken"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Details
                        </button>
                        <button
                          onClick={() => openEdit(emp)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-sunken"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        {emp.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleDisable(emp)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-warning hover:bg-warning-soft"
                          >
                            <Ban className="h-3.5 w-3.5" /> Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(emp)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-success hover:bg-success-soft"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(emp)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-soft"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </>
                  )}
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
    </>
  );
}

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
