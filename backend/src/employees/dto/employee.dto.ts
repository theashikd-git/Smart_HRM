import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export enum EmploymentTypeDto {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
}

export enum EmployeeStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
}

// Mirrors Prisma's LeaveEmployeeCategory enum. Chosen at employee creation
// (and changeable later by HR) -- this is what LeaveCategoryPolicy and the
// balance scheduler key off of, entirely separate from EmploymentTypeDto
// (full time/part time/contract/intern), which is about the job itself.
export enum LeaveEmployeeCategoryDto {
  PERMANENT = 'PERMANENT',
  PROVISION = 'PROVISION',
  CONTRACTUAL = 'CONTRACTUAL',
  TRIAL = 'TRIAL',
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

  // Required for every new hire -- which of the 7 leave-policy tracks they're
  // on. trialMonths is required alongside it only when the category is
  // TRIAL (validated in EmployeesService.create, since class-validator's
  // @ValidateIf needs the sibling property name known at decoration time,
  // which is fine here but the service still double-checks before writing).
  @IsNotEmpty()
  @IsEnum(LeaveEmployeeCategoryDto)
  leaveCategory: LeaveEmployeeCategoryDto;

  @ValidateIf((o) => o.leaveCategory === LeaveEmployeeCategoryDto.TRIAL)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  trialMonths?: number;
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

  @IsOptional() @IsEnum(LeaveEmployeeCategoryDto) leaveCategory?: LeaveEmployeeCategoryDto;

  @ValidateIf((o) => o.leaveCategory === LeaveEmployeeCategoryDto.TRIAL)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  trialMonths?: number;
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
