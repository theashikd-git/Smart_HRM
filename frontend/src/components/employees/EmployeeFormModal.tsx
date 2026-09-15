'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User as UserIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { cn } from '@/lib/utils';
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

type TabId = 'private' | 'device' | 'attendance' | 'payroll' | 'leave';

const TABS: { id: TabId; label: string }[] = [
  { id: 'private', label: 'Private Information' },
  { id: 'device', label: 'Device Access Settings' },
  { id: 'attendance', label: 'Attendance Settings' },
  { id: 'payroll', label: 'Payroll Settings' },
  { id: 'leave', label: 'Leave Group' },
];

const EMPTY_FORM = {
  employeeCode: '',
  fullName: '',
  photo: '',
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
  leaveCategory: '',
  trialMonths: '',
};

/**
 * Add/Edit Employee -- restyled after a reference biometric-attendance
 * system's layout: a compact "Profile" block up top (identity + a photo),
 * then the rest of the fields grouped into tabs instead of one long flat
 * form. Position/Area/Superior from that reference aren't fields Smart HRM
 * has (or needs) here -- Designation covers "position", there's no branch
 * concept, and reporting lines are set from Personnel > Superior
 * Management, not from this form.
 *
 * Required fields are checked by hand in handleSubmit (not HTML5
 * `required`) because some of them live inside a tab -- a browser skips
 * validating a hidden/display:none field, so if we relied on `required`
 * alone someone could save with an empty Gender or Employee Type just by
 * never opening that tab.
 */
export function EmployeeFormModal({ open, onClose, employee }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<TabId>('private');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { data: departments } = useDepartments();
  const { data: designations } = useDesignations();
  const { data: shifts } = useShifts();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const isEdit = !!employee;
  const saving = createEmployee.isPending || updateEmployee.isPending;

  useEffect(() => {
    setActiveTab('private');
    if (employee) {
      setForm({
        employeeCode: employee.employeeCode || '',
        fullName: employee.fullName || '',
        photo: employee.photo || '',
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
        leaveCategory: employee.leaveCategory || '',
        trialMonths: employee.trialMonths?.toString() || '',
      });
    } else {
      setForm({ ...EMPTY_FORM, employeeCode: String(Math.floor(1000 + Math.random() * 9000)) });
    }
  }, [employee, open]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('photo', reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.employeeCode.trim() || !form.fullName.trim() || !form.departmentId) {
      toast.error('Fill in Employee ID, Full Name, and Department');
      return;
    }
    if (!form.gender || !form.phone.trim()) {
      setActiveTab('private');
      toast.error('Gender and Phone are required, under Private Information');
      return;
    }
    if (!form.leaveCategory) {
      setActiveTab('leave');
      toast.error('Select an Employee Type, under Leave Group');
      return;
    }
    if (form.leaveCategory === 'TRIAL' && !form.trialMonths) {
      setActiveTab('leave');
      toast.error('Enter the Trial Duration, under Leave Group');
      return;
    }

    const payload: any = {
      ...form,
      photo: form.photo || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      joiningDate: form.joiningDate || undefined,
      departmentId: form.departmentId || undefined,
      designationId: form.designationId || undefined,
      shiftId: form.shiftId || undefined,
      deviceUserId: form.deviceUserId || undefined,
      trialMonths: form.leaveCategory === 'TRIAL' && form.trialMonths ? Number(form.trialMonths) : undefined,
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
      size="xl"
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
      <form id="employee-form" onSubmit={handleSubmit}>
        {/* Profile -- the compact identity block, always visible above the tabs */}
        <div className="mb-4 rounded-lg bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-text-secondary">
          Profile
        </div>
        <div className="flex flex-col sm:flex-row gap-5 mb-6">
          <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrap label="Employee ID" required hint="Auto-filled with a number; edit if you use your own ID scheme">
              <Input value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Full Name" required>
              <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Department" required>
              <Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                <option value="">Select</option>
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
            <FieldWrap label="Employment Type">
              <Select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </Select>
            </FieldWrap>
            <FieldWrap label="Hired Date">
              <Input type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} />
            </FieldWrap>
          </div>

          <div className="flex sm:flex-col items-center gap-2 sm:w-32 shrink-0">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface-sunken text-text-muted hover:border-accent hover:text-accent transition-colors"
            >
              {form.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-10 w-10" />
              )}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoPick} className="hidden" />
            <span className="text-xs text-text-muted">Photo</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels stay mounted (just hidden) so field values never reset
            when switching tabs; required-ness for anything in here is
            enforced in handleSubmit instead of via the `required` attribute
            (a hidden field is exempt from HTML5 constraint validation, so
            relying on `required` alone would let a hidden empty field pass
            silently). */}
        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', activeTab !== 'private' && 'hidden')}>
          <FieldWrap label="Gender" required>
            <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="Phone" required>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
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
          <FieldWrap label="Marital Status">
            <Select value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
              <option value="">Select</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </Select>
          </FieldWrap>
          <FieldWrap label="National ID">
            <Input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Emergency Contact">
            <Input value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Address">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </FieldWrap>
        </div>

        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', activeTab !== 'device' && 'hidden')}>
          <FieldWrap label="RFID Card Number" hint="For card-based check-in, if issued">
            <Input value={form.rfidCardNumber} onChange={(e) => set('rfidCardNumber', e.target.value)} />
          </FieldWrap>
          <FieldWrap
            label="Device User ID"
            hint="ID this employee will use on the fingerprint device. Leave blank to use the Employee ID."
          >
            <Input value={form.deviceUserId} onChange={(e) => set('deviceUserId', e.target.value)} />
          </FieldWrap>
        </div>

        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', activeTab !== 'attendance' && 'hidden')}>
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
        </div>

        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', activeTab !== 'payroll' && 'hidden')}>
          <FieldWrap label="Salary">
            <Input type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} />
          </FieldWrap>
        </div>

        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', activeTab !== 'leave' && 'hidden')}>
          <FieldWrap
            label="Employee Type"
            required
            hint="Which leave policy this employee follows -- Permanent, Provision (6-month probation), Contractual, or Trial"
          >
            <Select value={form.leaveCategory} onChange={(e) => set('leaveCategory', e.target.value)}>
              <option value="">Select</option>
              <option value="PERMANENT">Permanent</option>
              <option value="PROVISION">Provision (Probation)</option>
              <option value="CONTRACTUAL">Contractual</option>
              <option value="TRIAL">Trial</option>
            </Select>
          </FieldWrap>
          {form.leaveCategory === 'TRIAL' && (
            <FieldWrap label="Trial Duration (months)" required hint="How many months this employee's trial period runs">
              <Input
                type="number"
                min={1}
                value={form.trialMonths}
                onChange={(e) => set('trialMonths', e.target.value)}
              />
            </FieldWrap>
          )}
        </div>
      </form>
    </Modal>
  );
}
