'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useCreateDepartment } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

function codeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12);
}

/** "Add Department" popup: name, code, and an optional manager. */
export function AddDepartmentModal({ open, onClose }: Props) {
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [errors, setErrors] = useState<{ name?: string; code?: string; general?: string }>({});

  const { data: employees } = useEmployees({ pageSize: 500 });
  const createDepartment = useCreateDepartment();

  function reset() {
    setCode('');
    setCodeTouched(false);
    setName('');
    setManagerId('');
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!codeTouched) setCode(codeFromName(value));
  }

  function handleCodeChange(value: string) {
    setCodeTouched(true);
    setCode(value.toUpperCase());
  }

  async function handleConfirm() {
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
      await createDepartment.mutateAsync({
        name: name.trim(),
        code: code.trim(),
        headEmployeeId: managerId || undefined,
      });
      toast.success(`Department "${name.trim()}" created`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Department"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={createDepartment.isPending}>
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
          <FieldWrap label="Department Code" required error={errors.code} hint={!codeTouched ? 'Auto-filled from the name -- edit if needed' : undefined}>
            <Input value={code} onChange={(e) => handleCodeChange(e.target.value)} placeholder="e.g. RAD" />
          </FieldWrap>
          <FieldWrap label="Department Name" required error={errors.name}>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Radiology" />
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
