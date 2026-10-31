'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useUpdateHoliday } from '@/hooks/useHolidays';
import { apiErrorMessage } from '@/lib/api';
import type { Holiday } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  holiday: Holiday | null;
}

/** Edit Holiday popup: rename it, move its date, or change Government/Company type. */
export function EditHolidayModal({ open, onClose, holiday }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('GOVERNMENT');
  const [errors, setErrors] = useState<{ name?: string; date?: string; general?: string }>({});

  const updateHoliday = useUpdateHoliday();

  useEffect(() => {
    if (!open || !holiday) return;
    setName(holiday.name);
    setDate(holiday.date.slice(0, 10));
    setType(holiday.type);
    setErrors({});
  }, [open, holiday]);

  function handleClose() {
    onClose();
  }

  async function handleConfirm() {
    if (!holiday) return;
    const nextErrors: { name?: string; date?: string } = {};
    if (!name.trim()) nextErrors.name = 'Holiday name is required';
    if (!date) nextErrors.date = 'Date is required';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    try {
      await updateHoliday.mutateAsync({ id: holiday.id, name: name.trim(), date, type });
      toast.success(`Holiday "${name.trim()}" updated`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  if (!holiday) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit Holiday"
      subtitle={holiday.name}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={updateHoliday.isPending}>
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
          <Input value={name} onChange={(e) => setName(e.target.value)} />
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
