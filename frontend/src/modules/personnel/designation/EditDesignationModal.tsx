'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useUpdateDesignation } from '@/hooks/useDesignations';
import { useDepartments } from '@/hooks/useDepartments';
import { apiErrorMessage } from '@/lib/api';
import type { Designation } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  designation: Designation | null;
}

/** Edit Designation popup: rename it, reassign its department, or change status. */
export function EditDesignationModal({ open, onClose, designation }: Props) {
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [errors, setErrors] = useState<{ title?: string; general?: string }>({});

  const { data: departments } = useDepartments();
  const updateDesignation = useUpdateDesignation();

  useEffect(() => {
    if (!open || !designation) return;
    setTitle(designation.title);
    setDepartmentId(designation.departmentId ?? '');
    setStatus(designation.status);
    setErrors({});
  }, [open, designation]);

  function handleClose() {
    onClose();
  }

  async function handleConfirm() {
    if (!designation) return;
    if (!title.trim()) {
      setErrors({ title: 'Designation title is required' });
      return;
    }
    setErrors({});

    try {
      await updateDesignation.mutateAsync({
        id: designation.id,
        title: title.trim(),
        departmentId: departmentId || undefined,
        status,
      });
      toast.success(`Designation "${title.trim()}" updated`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  if (!designation) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit Designation"
      subtitle={designation.title}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={updateDesignation.isPending}>
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
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
        <FieldWrap label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </FieldWrap>
      </div>
    </Modal>
  );
}
