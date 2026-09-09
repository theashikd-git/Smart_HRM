import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/**
 * One sub-department row from the "Add Department" popup (e.g. "X-Ray",
 * "USG", "MRI" all added under one new "Radiology" department). Kept as a
 * loose interface validated in DepartmentsService rather than nested
 * class-validator decorators -- same reasoning as
 * SaveLeaveWorkflowDto.tiers: the row list is freely added to/removed
 * from on the client, so it doesn't need a class-transformer setup here.
 * No `code` field -- DepartmentsService generates one from the parent's
 * code + this name, since the popup only asks the user for a name.
 */
export interface CreateSubDepartmentRowInput {
  name: string;
  headEmployeeId?: string;
}

export class CreateDepartmentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  headEmployeeId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsEnum(OrgUnitStatusDto)
  status?: OrgUnitStatusDto;

  // Sub-departments to create together with this department, in the same
  // transaction, from the "Add Department" popup's Sub-Departments section.
  @IsOptional()
  @IsArray()
  subDepartments?: CreateSubDepartmentRowInput[];
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  headEmployeeId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsEnum(OrgUnitStatusDto)
  status?: OrgUnitStatusDto;
}
