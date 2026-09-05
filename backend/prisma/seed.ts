import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Smart HRM database...');

  // -- Company ---------------------------------------------------------
  const company = await prisma.company.upsert({
    where: { id: 'default-company' },
    update: {},
    create: {
      id: 'default-company',
      name: 'Acme Manufacturing Ltd.',
      timeZone: 'Asia/Dhaka',
      officeHours: '09:00 - 18:00',
      workingDays: 'Sun,Mon,Tue,Wed,Thu',
    },
  });

  // -- Admin user --------------------------------------------------------
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smarthrm.local' },
    update: {},
    create: {
      email: 'admin@smarthrm.local',
      fullName: 'System Administrator',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  const hrPassword = await bcrypt.hash('Hr@12345', 10);
  await prisma.user.upsert({
    where: { email: 'hr@smarthrm.local' },
    update: {},
    create: {
      email: 'hr@smarthrm.local',
      fullName: 'HR Officer',
      passwordHash: hrPassword,
      role: 'HR',
    },
  });

  // -- Departments -------------------------------------------------------
  const departmentNames: [string, string][] = [
    ['Human Resources', 'HR'],
    ['Accounts', 'ACC'],
    ['Sales', 'SLS'],
    ['Production', 'PRD'],
    ['Information Technology', 'IT'],
  ];
  const departments: Record<string, any> = {};
  for (const [name, code] of departmentNames) {
    departments[code] = await prisma.department.upsert({
      where: { code },
      update: {},
      create: { name, code },
    });
  }

  // -- Designations --------------------------------------------------------
  const designationTitles = ['CEO', 'HR Manager', 'Accountant', 'Supervisor', 'Operator', 'Developer'];
  const designations: Record<string, any> = {};
  for (const title of designationTitles) {
    designations[title] = await prisma.designation.upsert({
      where: { title },
      update: {},
      create: { title },
    });
  }

  // -- Shifts --------------------------------------------------------------
  const morningShift = await prisma.shift.upsert({
    where: { id: 'morning-shift' },
    update: {},
    create: {
      id: 'morning-shift',
      name: 'Morning Shift',
      startTime: '09:00',
      endTime: '18:00',
      graceMinutes: 10,
      breakMinutes: 60,
      weekendRule: 'Fri,Sat',
    },
  });

  const nightShift = await prisma.shift.upsert({
    where: { id: 'night-shift' },
    update: {},
    create: {
      id: 'night-shift',
      name: 'Night Shift',
      startTime: '22:00',
      endTime: '06:00',
      graceMinutes: 10,
      breakMinutes: 45,
      weekendRule: 'Fri,Sat',
    },
  });

  // -- Device ----------------------------------------------------------
  const device = await prisma.device.upsert({
    where: { id: 'primary-device' },
    update: {},
    create: {
      id: 'primary-device',
      name: 'Main Entrance Terminal',
      deviceModel: 'ZKTeco uFace 800 Plus',
      ipAddress: '192.168.1.201',
      port: 4370,
      connectionStatus: 'UNKNOWN',
    },
  });

  // -- Demo employees ------------------------------------------------------
  const demoEmployees = [
    {
      employeeCode: 'EMP-0001',
      fullName: 'Rahim Uddin',
      email: 'rahim.uddin@acme.local',
      phone: '+8801700000001',
      departmentId: departments['IT'].id,
      designationId: designations['Developer'].id,
      shiftId: morningShift.id,
      deviceUserId: '1',
      fingerprintEnrolled: true,
      status: 'ACTIVE' as const,
    },
    {
      employeeCode: 'EMP-0002',
      fullName: 'Karim Ahmed',
      email: 'karim.ahmed@acme.local',
      phone: '+8801700000002',
      departmentId: departments['PRD'].id,
      designationId: designations['Supervisor'].id,
      shiftId: morningShift.id,
      deviceUserId: '2',
      fingerprintEnrolled: true,
      status: 'ACTIVE' as const,
    },
    {
      employeeCode: 'EMP-0003',
      fullName: 'Fatima Begum',
      email: 'fatima.begum@acme.local',
      phone: '+8801700000003',
      departmentId: departments['HR'].id,
      designationId: designations['HR Manager'].id,
      shiftId: morningShift.id,
      deviceUserId: '3',
      faceEnrolled: true,
      status: 'ACTIVE' as const,
    },
    {
      employeeCode: 'EMP-0004',
      fullName: 'Jamal Hossain',
      email: 'jamal.hossain@acme.local',
      phone: '+8801700000004',
      departmentId: departments['SLS'].id,
      designationId: designations['Operator'].id,
      shiftId: nightShift.id,
      deviceUserId: '4',
      rfidEnrolled: true,
      rfidCardNumber: '000045821',
      status: 'ACTIVE' as const,
    },
    {
      employeeCode: 'EMP-0005',
      fullName: 'Nasrin Akter',
      email: 'nasrin.akter@acme.local',
      phone: '+8801700000005',
      departmentId: departments['ACC'].id,
      designationId: designations['Accountant'].id,
      shiftId: morningShift.id,
      deviceUserId: '5',
      fingerprintEnrolled: true,
      status: 'ACTIVE' as const,
    },
  ];

  for (const emp of demoEmployees) {
    await prisma.employee.upsert({
      where: { employeeCode: emp.employeeCode },
      update: {},
      create: {
        ...emp,
        joiningDate: new Date('2024-01-15'),
        employmentType: 'FULL_TIME',
        syncStatus: 'SYNCED',
        lastSyncDate: new Date(),
      },
    });
  }

  console.log('Seed complete.');
  console.log('---------------------------------------------');
  console.log(`Company: ${company.name}`);
  console.log(`Admin login: admin@smarthrm.local / Admin@123`);
  console.log(`HR login:    hr@smarthrm.local / Hr@12345`);
  console.log(`Device:      ${device.name} (${device.ipAddress}:${device.port})`);
  console.log('---------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
