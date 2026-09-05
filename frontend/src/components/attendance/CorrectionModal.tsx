'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { useCorrectAttendance } from '@/hooks/useAttendance';
import { apiErrorMessage } from '@/lib/api';
import { AttendanceRecord } from '@/types';

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function CorrectionModal({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}) {
  const correctAttendance = useCorrectAttendance();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState('PRESENT');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (record) {
      setCheckIn(toLocalInput(record.checkIn));
      setCheckOut(toLocalInput(record.checkOut));
      setStatus(record.status);
      setNotes(record.notes || '');
    }
  }, [record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    try {
      await correctAttendance.mutateAsync({
        id: record.id,
        checkIn: checkIn ? new Date(checkIn).toISOString() : undefined,
        checkOut: checkOut ? new Date(checkOut).toISOString() : undefined,
        status,
        notes,
      });
      toast.success('Attendance record corrected');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (!record) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct Attendance"
      subtitle={`${record.employee?.fullName} — ${new Date(record.date).toDateString()}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="correction-form" loading={correctAttendance.isPending}>
            Save Correction
          </Button>
        </>
      }
    >
      <form id="correction-form" onSubmit={handleSubmit} className="space-y-4">
        <FieldWrap label="Check In">
          <Input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Check Out">
          <Input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="HOLIDAY">Holiday</option>
          </Select>
        </FieldWrap>
        <FieldWrap label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for correction" />
        </FieldWrap>
      </form>
    </Modal>
  );
}
