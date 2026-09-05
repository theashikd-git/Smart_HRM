import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Wipes the built-in demo/seed content so a fresh deployment can be
 * populated with real company data. Deliberately does NOT touch:
 *   - User accounts (admin@smarthrm.local / hr@smarthrm.local) -- deleting
 *     these would lock you out of the app. Manage/replace them from
 *     Settings > Users once you're logged in.
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
 *   5. The Company profile row -- CompanyService.get() auto-creates a
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

  const company = await prisma.company.deleteMany({});
  console.log(`Deleted ${company.count} company profile row(s) (a blank one will be auto-created)`);

  const device = await prisma.device.findFirst();
  console.log('---------------------------------------------');
  console.log('Kept: user accounts (admin@smarthrm.local, hr@smarthrm.local)');
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
