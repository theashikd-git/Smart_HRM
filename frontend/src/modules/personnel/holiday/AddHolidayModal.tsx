'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useCreateHoliday } from '@/hooks/useHolidays';
import { apiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** "Add Holiday" popup: name, date, and Government/Company type. */
export function AddHolidayModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('GOVERNMENT');
  const [errors, setErrors] = useState<{ name?: string; date?: string; general?: string }>({});

  const createHoliday = useCreateHoliday();

  function reset() {
    setName('');
    setDate('');
    setType('GOVERNMENT');
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    const nextErrors: { name?: string; date?: string } = {};
    if (!name.trim()) nextErrors.name = 'Holiday name is required';
    if (!date) nextErrors.date = 'Date is required';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    try {
      await createHoliday.mutateAsync({ name: name.trim(), date, type });
      toast.success(`Holiday "${name.trim()}" added`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Holiday"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={createHoliday.isPending}>
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
        <FieldWrap label="Holiday Name" required error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Independence Day" autoFocus />
        </FieldWrap>
        <FieldWrap label="Date" required error={errors.date}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="GOVERNMENT">Government</option>
            <option value="COMPANY">Company</option>
          </Select>
        </FieldWrap>
      </div>
    </Modal>
  );
}
