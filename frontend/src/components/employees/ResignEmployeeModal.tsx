'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Textarea } from '@/components/ui/Form';
import { useResignEmployee } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';
import { Employee } from '@/types';

/**
 * "Mark as Resigned" dialog -- opened from the Employee profile's status
 * control (see EmployeeStatusToggle in EmployeeProfileContent). Sets the
 * employee's status to RESIGNED with a last working day and an optional
 * reason; the employee then stops showing as Active/Inactive and starts
 * showing up on the Resigned Employees screen instead (which is just the
 * normal employee list filtered to status=RESIGNED).
 */
export function ResignEmployeeModal({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const [resignationDate, setResignationDate] = useState('');
  const [reason, setReason] = useState('');
  const resignEmployee = useResignEmployee();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    if (!resignationDate) {
      toast.error('Last working day is required');
      return;
    }
    try {
      await resignEmployee.mutateAsync({ id: employee.id, resignationDate, reason: reason || undefined });
      toast.success(`${employee.fullName} marked as resigned`);
      setResignationDate('');
      setReason('');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={!!employee}
      onClose={onClose}
      title="Mark as Resigned"
      subtitle={employee ? `${employee.fullName} (${employee.employeeCode})` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" form="resign-employee-form" loading={resignEmployee.isPending}>
            Mark as Resigned
          </Button>
        </>
      }
    >
      <form id="resign-employee-form" onSubmit={handleSubmit} className="space-y-4">
        <FieldWrap label="Last Working Day" required>
          <Input type="date" value={resignationDate} onChange={(e) => setResignationDate(e.target.value)} required />
        </FieldWrap>
        <FieldWrap label="Reason" hint="Optional">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Resignation, Contract End" />
        </FieldWrap>
      </form>
    </Modal>
  );
}
