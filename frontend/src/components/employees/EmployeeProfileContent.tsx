import { ReactNode } from 'react';
import { Fingerprint, Scan, CreditCard } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/Card';
import { employeeStatusColors, syncStatusColors, formatDate, formatDateTime } from '@/lib/utils';
import { Employee } from '@/types';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm text-text-primary mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

/**
 * Full read-only employee profile. Shared by the EmployeeDetailModal (used on the
 * legacy /employees flow) and the Workbench Employee program's Profile tab, so the
 * real employee data/formatting logic exists in exactly one place.
 */
export function EmployeeProfileContent({ employee }: { employee: Employee }) {
  const salary =
    employee.salary != null
      ? Number(employee.salary).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={employee.fullName} size="lg" scanFrame />
        <div>
          <p className="text-base font-semibold text-text-primary">{employee.fullName}</p>
          <p className="text-xs text-text-muted font-mono">{employee.employeeCode}</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusPill label={employee.status} colors={employeeStatusColors[employee.status]} />
            <StatusPill
              label={employee.syncStatus.replace('_', ' ')}
              colors={syncStatusColors[employee.syncStatus]}
              pulsing={employee.syncStatus === 'PENDING'}
            />
          </div>
        </div>
      </div>

      <Section title="Personal Information">
        <Field label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
        <Field label="Gender" value={employee.gender} />
        <Field label="Blood Group" value={employee.bloodGroup} />
        <Field label="Marital Status" value={employee.maritalStatus} />
        <Field label="National ID" value={employee.nationalId} />
        <Field label="Passport" value={employee.passport} />
      </Section>

      <Section title="Contact">
        <Field label="Email" value={employee.email} />
        <Field label="Phone" value={employee.phone} />
        <Field label="Emergency Contact" value={employee.emergencyContact} />
        <Field label="Address" value={employee.address} />
      </Section>

      <Section title="Employment">
        <Field label="Department" value={employee.department?.name} />
        <Field label="Designation" value={employee.designation?.title} />
        <Field
          label="Shift"
          value={employee.shift ? `${employee.shift.name} (${employee.shift.startTime}–${employee.shift.endTime})` : null}
        />
        <Field label="Employment Type" value={employee.employmentType?.replace('_', ' ')} />
        <Field label="Joining Date" value={formatDate(employee.joiningDate)} />
        <Field label="Salary" value={salary} />
      </Section>

      <Section title="Biometric & Device">
        <Field label="Device User ID" value={employee.deviceUserId ? <span className="font-mono">{employee.deviceUserId}</span> : null} />
        <Field label="Last Synced" value={formatDateTime(employee.lastSyncDate)} />
        <Field
          label="Fingerprint"
          value={
            <span className="flex items-center gap-1.5">
              <Fingerprint className="h-3.5 w-3.5" />
              {employee.fingerprintEnrolled ? 'Enrolled' : 'Not enrolled'}
            </span>
          }
        />
        <Field
          label="Face"
          value={
            <span className="flex items-center gap-1.5">
              <Scan className="h-3.5 w-3.5" />
              {employee.faceEnrolled ? 'Enrolled' : 'Not enrolled'}
            </span>
          }
        />
        <Field
          label="RFID Card"
          value={
            employee.rfidCardNumber ? (
              <span className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                {employee.rfidCardNumber} {employee.rfidEnrolled ? '(enrolled)' : ''}
              </span>
            ) : null
          }
        />
      </Section>
    </div>
  );
}
