import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export enum EmploymentTypeDto {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
}

// EMPLOYEE/MANAGER/SUPERVISOR -> ordinary Employee ID self-service login
// (Manager/Supervisor are a label only here -- see the schema's
// EmployeeRole enum for why they don't grant real staff permissions).
// ADMINISTRATOR -> a staff login (role ADMIN), using staffUsername/
// staffPassword below instead of an Employee ID.
export enum EmployeeRoleDto {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  ADMINISTRATOR = 'ADMINISTRATOR',
}

export enum EmployeeStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
}

export class CreateEmployeeDto {
  @IsNotEmpty()
  @IsString()
  employeeCode: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;

  @IsNotEmpty()
  @IsString()
  gender: string;

  @IsOptional() @IsString() nationalId?: string;
  @IsOptional() @IsString() passport?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() maritalStatus?: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() emergencyContact?: string;

  @IsOptional() @IsDateString() joiningDate?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designationId?: string;
  @IsOptional() @IsString() shiftId?: string;
  @IsOptional() @IsEnum(EmploymentTypeDto) employmentType?: EmploymentTypeDto;
  @IsOptional() @IsNumber() salary?: number;
  @IsOptional() @IsEnum(EmployeeStatusDto) status?: EmployeeStatusDto;

  @IsOptional() @IsString() rfidCardNumber?: string;

  @IsOptional()
  @IsString()
  deviceUserId?: string;

  // Required for every new hire -- which HR-configurable employee-type
  // category (Permanent/Provision/Contractual/Trial, or any HR has added)
  // they're on. Whether trialMonths is also required depends on that
  // category's own hasFixedPeriod/defaultPeriodMonths -- EmployeesService
  // .create() loads the category and enforces it there, since the DTO
  // can't see another table's row at validation time.
  @IsNotEmpty()
  @IsString()
  leaveCategoryId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  trialMonths?: number;

  // Decides the kind of login provisioned for this hire (see EmployeeRole
  // in the schema) -- defaults to EMPLOYEE (Employee ID self-service login)
  // when omitted, same as before this field existed.
  @IsOptional()
  @IsEnum(EmployeeRoleDto)
  employeeRole?: EmployeeRoleDto;

  // Required (by EmployeesService, not here -- validation depends on
  // employeeRole above) only when employeeRole is ADMINISTRATOR; ignored
  // otherwise.
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'staffUsername may only contain letters, numbers, dots, underscores and hyphens',
  })
  staffUsername?: string;

  @IsOptional()
  @MinLength(6)
  staffPassword?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() nationalId?: string;
  @IsOptional() @IsString() passport?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() maritalStatus?: string;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() emergencyContact?: string;

  @IsOptional() @IsDateString() joiningDate?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designationId?: string;
  @IsOptional() @IsString() shiftId?: string;
  @IsOptional() @IsEnum(EmploymentTypeDto) employmentType?: EmploymentTypeDto;
  @IsOptional() @IsNumber() salary?: number;
  @IsOptional() @IsEnum(EmployeeStatusDto) status?: EmployeeStatusDto;

  @IsOptional() @IsString() rfidCardNumber?: string;

  @IsOptional()
  @IsString()
  deviceUserId?: string;

  @IsOptional() @IsString() leaveCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  trialMonths?: number;

  @IsOptional()
  @IsEnum(EmployeeRoleDto)
  employeeRole?: EmployeeRoleDto;

  // Only used (and only required) when employeeRole is being set/changed to
  // ADMINISTRATOR and this employee doesn't already have a staff login with
  // credentials -- see EmployeesService.update. Leave blank to keep an
  // existing Administrator's current username/password unchanged.
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'staffUsername may only contain letters, numbers, dots, underscores and hyphens',
  })
  staffUsername?: string;

  @IsOptional()
  @MinLength(6)
  staffPassword?: string;
}

export class EmployeeQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designationId?: string;
  @IsOptional() @IsString() shiftId?: string;
  @IsOptional() @IsEnum(EmployeeStatusDto) status?: EmployeeStatusDto;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}
