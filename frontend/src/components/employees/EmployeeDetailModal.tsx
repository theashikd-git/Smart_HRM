'use client';

import { Pencil } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmployeeProfileContent } from './EmployeeProfileContent';
import { Employee } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  onEdit: (employee: Employee) => void;
}

export function EmployeeDetailModal({ open, onClose, employee, onEdit }: Props) {
  if (!employee) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Employee Details"
      subtitle={`${employee.fullName} (${employee.employeeCode})`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onEdit(employee);
              onClose();
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Employee
          </Button>
        </>
      }
    >
      <EmployeeProfileContent employee={employee} />
    </Modal>
  );
}
