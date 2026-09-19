import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Wipes the built-in demo/seed content so a fresh deployment can be
 * populated with real company data. Deliberately keeps ONLY the
 * admin@smarthrm.local login -- every other seeded account, including
 * hr@smarthrm.local, is removed along with the rest of the demo data, so
 * there's exactly one way back in after this runs. Also does NOT touch:
 *   - The Device record -- if you already pointed it at real hardware
 *     (edited the IP from the Device page), it now represents your real
 *     terminal, not demo data. Its DeviceLogs are left alone too.
 *
 * Deletes, in FK-safe order:
 *   1. SyncHistory (references employees/devices, so it goes first)
 *   2. AuditLog (references employee/department/etc IDs that are about
 *      to disappear; not a real FK, but stale entries are just noise)
 *   3. Every Employee (Documents, AttendanceLogs, AttendanceRecords
 *      cascade-delete automatically per schema.prisma)
 *   4. Departments, Designations, Shifts (safe now that no employee
 *      references them)
 *   5. Every demo User account except admin@smarthrm.local (their
 *      Notifications cascade-delete automatically; AuditLog/SyncHistory
 *      rows referencing them are already gone from steps 1-2)
 *   6. The Company profile row -- CompanyService.get() auto-creates a
 *      blank placeholder the next time anyone opens Settings, so there's
 *      always a row to edit.
 */
async function main() {
  console.log('Clearing demo data from Smart HRM...');

  const syncHistory = await prisma.syncHistory.deleteMany({});
  console.log(`Deleted ${syncHistory.count} sync history record(s)`);

  const auditLogs = await prisma.auditLog.deleteMany({});
  console.log(`Deleted ${auditLogs.count} audit log entr(y/ies)`);

  const employees = await prisma.employee.deleteMany({});
  console.log(`Deleted ${employees.count} employee(s) (documents/attendance cascaded)`);

  const departments = await prisma.department.deleteMany({});
  console.log(`Deleted ${departments.count} department(s)`);

  const designations = await prisma.designation.deleteMany({});
  console.log(`Deleted ${designations.count} designation(s)`);

  const shifts = await prisma.shift.deleteMany({});
  console.log(`Deleted ${shifts.count} shift(s)`);

  const extraUsers = await prisma.user.deleteMany({ where: { email: { not: 'admin@smarthrm.local' } } });
  console.log(`Deleted ${extraUsers.count} other demo login(s) (kept admin@smarthrm.local only)`);

  const company = await prisma.company.deleteMany({});
  console.log(`Deleted ${company.count} company profile row(s) (a blank one will be auto-created)`);

  const device = await prisma.device.findFirst();
  console.log('---------------------------------------------');
  console.log('Kept: admin@smarthrm.local only -- log in with that, then create any other logins you need from Settings > Users');
  console.log(
    device
      ? `Kept: device "${device.name}" (${device.ipAddress}:${device.port}) -- edit or remove it yourself from the Device page if needed`
      : 'No device record found',
  );
  console.log('Done. Add your real departments, designations, shifts, company profile, and employees.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
