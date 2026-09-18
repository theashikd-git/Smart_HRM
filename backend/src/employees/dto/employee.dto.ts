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
