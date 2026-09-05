import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { DesignationsModule } from './designations/designations.module';
import { ShiftsModule } from './shifts/shifts.module';
import { DevicesModule } from './devices/devices.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { BranchesModule } from './branches/branches.module';
import { LocationsModule } from './locations/locations.module';
import { SubDepartmentsModule } from './sub-departments/sub-departments.module';
import { SectionsModule } from './sections/sections.module';
import { GradesModule } from './grades/grades.module';
import { DepartmentSuperiorsModule } from './department-superiors/department-superiors.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    EmployeesModule,
    DepartmentsModule,
    DesignationsModule,
    ShiftsModule,
    DevicesModule,
    AttendanceModule,
    LeaveModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
    BranchesModule,
    LocationsModule,
    SubDepartmentsModule,
    SectionsModule,
    GradesModule,
    DepartmentSuperiorsModule,
  ],
})
export class AppModule {}
