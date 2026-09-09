import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateSubDepartmentDto {
  @IsNotEmpty() @IsString() departmentId: string;
  @IsNotEmpty() @IsString() name: string;
  // Optional -- when omitted, SubDepartmentsService generates one from the
  // parent department's code + this name (see DepartmentsService for the
  // same generator, used when a sub-department is created together with
  // its parent from the Add Department popup).
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() headEmployeeId?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}

export class UpdateSubDepartmentDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() headEmployeeId?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}
