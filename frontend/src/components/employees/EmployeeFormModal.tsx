'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useCreateEmployee, useUpdateEmployee } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useDesignations } from '@/hooks/useDesignations';
import { useShifts } from '@/hooks/useShifts';
import { apiErrorMessage } from '@/lib/api';
import { Employee } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

const EMPTY_FORM = {
  employeeCode: '',
  fullName: '',
  email: '',
  phone: '',
  gender: '',
  bloodGroup: '',
  maritalStatus: '',
  nationalId: '',
  address: '',
  emergencyContact: '',
  joiningDate: '',
  departmentId: '',
  designationId: '',
  shiftId: '',
  employmentType: 'FULL_TIME',
  salary: '',
  rfidCardNumber: '',
  deviceUserId: '',
};

export function EmployeeFormModal({ open, onClose, employee }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const { data: departments } = useDepartments();
  const { data: designations } = useDesignations();
  const { data: shifts } = useShifts();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const isEdit = !!employee;
  const saving = createEmployee.isPending || updateEmployee.isPending;

  useEffect(() => {
    if (employee) {
      setForm({
        employeeCode: employee.employeeCode || '',
        fullName: employee.fullName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        gender: employee.gender || '',
        bloodGroup: employee.bloodGroup || '',
        maritalStatus: employee.maritalStatus || '',
        nationalId: employee.nationalId || '',
        address: employee.address || '',
        emergencyContact: employee.emergencyContact || '',
        joiningDate: employee.joiningDate ? employee.joiningDate.slice(0, 10) : '',
        departmentId: employee.departmentId || '',
        designationId: employee.designationId || '',
        shiftId: employee.shiftId || '',
        employmentType: employee.employmentType || 'FULL_TIME',
        salary: employee.salary?.toString() || '',
        rfidCardNumber: employee.rfidCardNumber || '',
        deviceUserId: employee.deviceUserId || '',
      });
    } else {
      setForm({ ...EMPTY_FORM, employeeCode: String(Math.floor(1000 + Math.random() * 9000)) });
    }
  }, [employee, open]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      ...form,
      salary: form.salary ? Number(form.salary) : undefined,
      joiningDate: form.joiningDate || undefined,
      departmentId: form.departmentId || undefined,
      designationId: form.designationId || undefined,
      shiftId: form.shiftId || undefined,
      deviceUserId: form.deviceUserId || undefined,
    };

    try {
      let saved: Employee;
      if (isEdit && employee) {
        saved = await updateEmployee.mutateAsync({ id: employee.id, ...payload });
      } else {
        saved = await createEmployee.mutateAsync(payload);
      }

      const verb = isEdit ? 'updated' : 'created';
      if (saved.syncStatus === 'SYNCED') {
        toast.success(`Employee ${verb} and synced to the device`);
      } else if (saved.syncStatus === 'FAILED') {
        toast.error(`Employee ${verb}, but device sync failed — it will auto-retry (or use Retry Failed on the Device page)`);
      } else {
        toast.success(`Employee ${verb}`);
      }
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      subtitle={isEdit ? `Editing ${employee?.fullName}` : 'New employee will be pushed to the biometric device automatically'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="employee-form" loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Employee'}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldWrap label="Employee ID" required hint="Auto-filled with a number; edit if you use your own ID scheme">
          <Input value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} required />
        </FieldWrap>
        <FieldWrap label="Full Name" required>
          <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
        </FieldWrap>
        <FieldWrap label="Email">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Phone" required>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
        </FieldWrap>
        <FieldWrap label="Gender" required>
          <Select value={form.gender} onChange={(e) => set('gender', e.target.value)} required>
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </Select>
        </FieldWrap>
        <FieldWrap label="Blood Group">
          <Select value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
            <option value="">Select</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="National ID">
          <Input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Marital Status">
          <Select value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
            <option value="">Select</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
          </Select>
        </FieldWrap>
        <FieldWrap label="Emergency Contact">
          <Input value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Joining Date">
          <Input type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Address" hint="">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} className="sm:col-span-2" />
        </FieldWrap>

        <FieldWrap label="Department">
          <Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">Unassigned</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Designation">
          <Select value={form.designationId} onChange={(e) => set('designationId', e.target.value)}>
            <option value="">Unassigned</option>
            {designations?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Shift">
          <Select value={form.shiftId} onChange={(e) => set('shiftId', e.target.value)}>
            <option value="">Unassigned</option>
            {shifts?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Employment Type">
          <Select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
            <option value="FULL_TIME">Full Time</option>
            <option value="PART_TIME">Part Time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </Select>
        </FieldWrap>
        <FieldWrap label="Salary">
          <Input type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} />
        </FieldWrap>
        <FieldWrap label="RFID Card Number" hint="For card-based check-in, if issued">
          <Input value={form.rfidCardNumber} onChange={(e) => set('rfidCardNumber', e.target.value)} />
        </FieldWrap>
        <FieldWrap
          label="Device User ID"
          hint="ID this employee will use on the fingerprint device. Leave blank to use the Employee ID."
        >
          <Input value={form.deviceUserId} onChange={(e) => set('deviceUserId', e.target.value)} />
        </FieldWrap>
      </form>
    </Modal>
  );
}
