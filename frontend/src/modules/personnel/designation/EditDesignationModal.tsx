'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useUpdateDesignation } from '@/hooks/useDesignations';
import { apiErrorMessage } from '@/lib/api';
import type { Designation } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  designation: Designation | null;
}

/** Edit Designation popup: rename it or change its status. */
export function EditDesignationModal({ open, onClose, designation }: Props) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [errors, setErrors] = useState<{ title?: string; general?: string }>({});

  const updateDesignation = useUpdateDesignation();

  useEffect(() => {
    if (!open || !designation) return;
    setTitle(designation.title);
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
