'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useManualPunch } from '@/hooks/useAttendance';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';

export function ManualPunchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: employees } = useEmployees({ pageSize: 200 });
  const manualPunch = useManualPunch();
  const [employeeId, setEmployeeId] = useState('');
  const [timestamp, setTimestamp] = useState(() => new Date().toISOString().slice(0, 16));
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      toast.error('Select an employee');
      return;
    }
    try {
      await manualPunch.mutateAsync({ employeeId, timestamp: new Date(timestamp).toISOString(), direction });
      toast.success('Manual punch recorded');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual Punch Entry"
      subtitle="For missed swipes or corrections"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="manual-punch-form" loading={manualPunch.isPending}>
            Record Punch
          </Button>
        </>
      }
    >
      <form id="manual-punch-form" onSubmit={handleSubmit} className="space-y-4">
        <FieldWrap label="Employee" required>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Select employee</option>
            {employees?.items.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.employeeCode})
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Date & Time" required>
          <Input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            required
          />
        </FieldWrap>
        <FieldWrap label="Direction" required>
          <Select value={direction} onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}>
            <option value="IN">Check In</option>
            <option value="OUT">Check Out</option>
          </Select>
        </FieldWrap>
      </form>
    </Modal>
  );
}
