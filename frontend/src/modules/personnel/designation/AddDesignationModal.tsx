'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useCreateDesignation } from '@/hooks/useDesignations';
import { useDepartments } from '@/hooks/useDepartments';
import { apiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** "Add Designation" popup: title and an optional department. */
export function AddDesignationModal({ open, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [errors, setErrors] = useState<{ title?: string; general?: string }>({});

  const { data: departments } = useDepartments();
  const createDesignation = useCreateDesignation();

  function reset() {
    setTitle('');
    setDepartmentId('');
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (!title.trim()) {
      setErrors({ title: 'Designation title is required' });
      return;
    }
    setErrors({});

    try {
      await createDesignation.mutateAsync({
        title: title.trim(),
        departmentId: departmentId || undefined,
      });
      toast.success(`Designation "${title.trim()}" created`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Designation"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={createDesignation.isPending}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.general && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {errors.general}
          </div>
        )}
        <FieldWrap label="Designation Title" required error={errors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Staff Nurse" autoFocus />
        </FieldWrap>
        <FieldWrap label="Department" hint="Optional -- leave unassigned to apply anywhere">
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Unassigned</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FieldWrap>
      </div>
    </Modal>
  );
}
