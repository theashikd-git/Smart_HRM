'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User as UserIcon, KeyRound, Copy, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { cn } from '@/lib/utils';
import { useCreateEmployee, useUpdateEmployee, useResetEmployeePassword } from '@/hooks/useEmployees';
import { useAuthStore } from '@/lib/auth-store';
import { useDepartments } from '@/hooks/useDepartments';
import { useDesignations } from '@/hooks/useDesignations';
import { useShifts } from '@/hooks/useShifts';
import { useEmployeeCategories } from '@/hooks/useLeave';
import { apiErrorMessage } from '@/lib/api';
import { Employee } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

type TabId = 'private' | 'device' | 'attendance' | 'payroll';

const TABS: { id: TabId; label: string }[] = [
  { id: 'private', label: 'Private Information' },
  { id: 'device', label: 'Device Access Settings' },
  { id: 'attendance', label: 'Attendance Settings' },
  { id: 'payroll', label: 'Payroll Settings' },
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
  leaveCategoryId: '',
  trialMonths: '',
  // Cosmetic label (Employee/Manager/Supervisor -> still an Employee ID
  // login) unless Administrator, which provisions/uses a real staff login
  // instead -- see the EmployeeRole type in @/types for the full story.
  employeeRole: 'EMPLOYEE',
  staffUsername: '',
  staffPassword: '',
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
 * Employee Type (and its Duration override) live on the front page --
 * always visible, not behind a tab -- since every employee needs one set.
 * Required fields still living inside a tab (Gender, Phone) are checked by
 * hand in handleSubmit (not HTML5 `required`), because a browser skips
 * validating a hidden/display:none field -- relying on `required` alone
 * would let someone save with an empty Gender just by never opening that
 * tab.
 */
export function EmployeeFormModal({ open, onClose, employee }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<TabId>('private');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { data: departments } = useDepartments();
  const { data: designations } = useDesignations();
  const { data: shifts } = useShifts();
  const { data: employeeCategories } = useEmployeeCategories();
  const selectedCategory = employeeCategories?.find((c) => c.id === form.leaveCategoryId);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const resetPassword = useResetEmployeePassword();
  // Only an actual Administrator can hand out a new Administrator login
  // from this form (mirrors the backend guard in EmployeesController) --
  // an HR user can still see/keep an existing Administrator's role, just
  // not switch someone else into it.
  const viewerRole = useAuthStore((s) => s.user?.role);
  const wasAdministrator = employee?.employeeRole === 'ADMINISTRATOR';

  const isEdit = !!employee;
  const saving = createEmployee.isPending || updateEmployee.isPending;

  // Set once a reset succeeds -- shown inline so HR can read/copy it before
  // closing the modal (it's a one-time value, never retrievable again after
  // this). Cleared whenever the modal is reopened for a different employee.
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleResetPassword() {
    if (!employee) return;
    // Covers both cases in one prompt since we can't tell which applies
    // without a separate lookup: an existing password is reset, or -- for
    // an employee added before login auto-provisioning existed -- a login
    // is created for them on the spot.
    if (
      !confirm(
        `Reset (or create, if they don't have one yet) the portal login for ${employee.fullName}? Any existing password stops working immediately, and they'll be asked to set a new one on next sign-in.`,
      )
    ) {
      return;
    }
    try {
      const { tempPassword: next, created } = await resetPassword.mutateAsync(employee.id);
      setTempPassword(next);
      setCopied(false);
      toast.success(
        created
          ? 'Portal login created -- share the temporary password below with the employee'
          : 'Password reset -- share the temporary password below with the employee',
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleCopyTempPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy -- select and copy it manually');
    }
  }

  useEffect(() => {
    setActiveTab('private');
    setTempPassword(null);
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
        leaveCategoryId: employee.leaveCategoryId || '',
        trialMonths: employee.trialMonths?.toString() || '',
        employeeRole: employee.employeeRole || 'EMPLOYEE',
        staffUsername: '',
        staffPassword: '',
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

    if (
      !form.employeeCode.trim() ||
      !form.fullName.trim() ||
      !form.departmentId ||
      !form.designationId ||
      !form.joiningDate ||
      !form.employeeRole
    ) {
      toast.error('Fill in Employee ID, Full Name, Department, Designation, Hired Date, and Employee Role');
      return;
    }
    if (!form.gender || !form.phone.trim()) {
      setActiveTab('private');
      toast.error('Gender and Phone are required, under Private Information');
      return;
    }
    if (!form.leaveCategoryId) {
      toast.error('Select an Employee Type');
      return;
    }
    if (selectedCategory?.hasFixedPeriod && !selectedCategory?.defaultPeriodMonths && !form.trialMonths) {
      toast.error('Enter the Duration');
      return;
    }

    // Only require staff credentials when this is an actual *new*
    // Administrator conversion -- if the employee is already an
    // Administrator and nothing here changed, staffUsername/staffPassword
    // are left blank on purpose (backend keeps the existing login as-is).
    const becomingAdministrator = form.employeeRole === 'ADMINISTRATOR' && !wasAdministrator;
    if (becomingAdministrator && (!form.staffUsername.trim() || !form.staffPassword.trim())) {
      toast.error('Enter a staff username and password for the new Administrator login');
      return;
    }

    const payload: any = {
      ...form,
      photo: form.photo || undefined,
      email: form.email.trim() || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      joiningDate: form.joiningDate || undefined,
      departmentId: form.departmentId || undefined,
      designationId: form.designationId || undefined,
      shiftId: form.shiftId || undefined,
      deviceUserId: form.deviceUserId || undefined,
      trialMonths: selectedCategory?.hasFixedPeriod && form.trialMonths ? Number(form.trialMonths) : undefined,
      staffUsername: form.staffUsername.trim() || undefined,
      staffPassword: form.staffPassword.trim() || undefined,
    };

    try {
      let saved: Employee;
      if (isEdit && employee) {
        saved = await updateEmployee.mutateAsync({ id: employee.id, ...payload });
      } else {
        saved = await createEmployee.mutateAsync(payload);
      }

      // The device push now happens in the background (so saving doesn't
      // block on a slow/unreachable biometric device), so syncStatus here
      // is almost always still 'PENDING' right after save -- SYNCED/FAILED
      // only show up if the push happened to finish first. Either way this
      // save itself succeeded; the wording just says what to expect next.
      const verb = isEdit ? 'updated' : 'created';
      if (saved.syncStatus === 'SYNCED') {
        toast.success(`Employee ${verb} and synced to the device`);
      } else if (saved.syncStatus === 'FAILED') {
        toast.error(`Employee ${verb}, but device sync failed — it will auto-retry (or use Retry Failed on the Device page)`);
      } else {
        toast.success(`Employee ${verb} — syncing to the device in the background`);
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
            <FieldWrap label="Designation" required>
              <Select value={form.designationId} onChange={(e) => set('designationId', e.target.value)}>
                <option value="">Select</option>
                {designations?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            </FieldWrap>
            <FieldWrap label="Hired Date" required>
              <Input type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} />
            </FieldWrap>
            <FieldWrap label="Employee Role" required>
              <Select value={form.employeeRole} onChange={(e) => set('employeeRole', e.target.value)}>
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="SUPERVISOR">Supervisor</option>
                {(viewerRole === 'ADMIN' || wasAdministrator) && <option value="ADMINISTRATOR">Administrator</option>}
              </Select>
            </FieldWrap>
            {form.employeeRole === 'ADMINISTRATOR' && (
              <>
                <FieldWrap
                  label="Staff Username"
                  required={!wasAdministrator}
                  hint={wasAdministrator ? 'Leave blank to keep the current username' : undefined}
                >
                  <Input value={form.staffUsername} onChange={(e) => set('staffUsername', e.target.value)} />
                </FieldWrap>
                <FieldWrap
                  label="Staff Password"
                  required={!wasAdministrator}
                  hint={wasAdministrator ? 'Leave blank to keep the current password' : undefined}
                >
                  <Input type="password" value={form.staffPassword} onChange={(e) => set('staffPassword', e.target.value)} />
                </FieldWrap>
              </>
            )}
            <FieldWrap label="Employee Type" required>
              <Select value={form.leaveCategoryId} onChange={(e) => set('leaveCategoryId', e.target.value)}>
                <option value="">Select</option>
                {employeeCategories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FieldWrap>
            {selectedCategory?.hasFixedPeriod && (
              <FieldWrap
                label="Duration (months)"
                required={!selectedCategory.defaultPeriodMonths}
                hint={
                  selectedCategory.defaultPeriodMonths
                    ? `Defaults to ${selectedCategory.defaultPeriodMonths} months -- override here if this employee's period differs`
                    : "How many months this employee's period runs"
                }
              >
                <Input
                  type="number"
                  min={1}
                  placeholder={selectedCategory.defaultPeriodMonths ? String(selectedCategory.defaultPeriodMonths) : undefined}
                  value={form.trialMonths}
                  onChange={(e) => set('trialMonths', e.target.value)}
                />
              </FieldWrap>
            )}
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

          {isEdit && employee && (
            <div className="sm:col-span-2 rounded-lg border border-line p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">Employee Portal Login</p>
                  <p className="text-xs text-text-secondary">
                    If {employee.fullName.split(' ')[0]} forgot their password, reset it here and give them the
                    temporary password shown below -- they'll be asked to set their own on next sign-in.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={resetPassword.isPending}
                  onClick={handleResetPassword}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset Password
                </Button>
              </div>

              {tempPassword && (
                <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                  <div>
                    <p className="text-xs text-amber-800">Temporary password (shown once -- copy it now)</p>
                    <p className="font-mono text-sm font-semibold tracking-wide text-amber-900">{tempPassword}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyTempPassword}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          )}
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

      </form>
    </Modal>
  );
}
