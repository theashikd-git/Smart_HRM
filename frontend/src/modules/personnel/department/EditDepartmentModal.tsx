'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useUpdateDepartment } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';
import type { Department } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  department: Department | null;
}

/**
 * Edit Department popup: rename the department and change its manager,
 * saved in one Confirm click.
 */
export function EditDepartmentModal({ open, onClose, department }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [errors, setErrors] = useState<{ name?: string; code?: string; general?: string }>({});

  const { data: employees } = useEmployees({ pageSize: 500 });
  const updateDepartment = useUpdateDepartment();

  // Re-seed the form every time a different department is opened for
  // editing (or the popup is reopened on the same one after a refetch).
  useEffect(() => {
    if (!open || !department) return;
    setCode(department.code);
    setName(department.name);
    setManagerId(department.headEmployeeId || '');
    setErrors({});
  }, [open, department]);

  function handleClose() {
    onClose();
  }

  async function handleConfirm() {
    if (!department) return;
    const nextErrors: typeof errors = {};

    if (!name.trim()) nextErrors.name = 'Department name is required';
    if (!code.trim()) nextErrors.code = 'Department code is required';

    const hasErrors = !!nextErrors.name || !!nextErrors.code;
    if (hasErrors) {
      setErrors(nextErrors);
      return; // leave the popup open so the user can fix the flagged field(s)
    }
    setErrors({});

    try {
      await updateDepartment.mutateAsync({
        id: department.id,
        name: name.trim(),
        code: code.trim(),
        headEmployeeId: managerId || undefined,
      });
      toast.success(`Department "${name.trim()}" updated`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  if (!department) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit Department"
      subtitle={department.name}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={updateDepartment.isPending}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {errors.general && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {errors.general}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrap label="Department Code" required error={errors.code}>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </FieldWrap>
          <FieldWrap label="Department Name" required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Department Manager" hint="Optional">
            <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">No manager</option>
              {employees?.items.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>
      </div>
    </Modal>
  );
}
