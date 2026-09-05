import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateSubDepartmentDto {
  @IsNotEmpty() @IsString() departmentId: string;
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsString() code: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}

export class UpdateSubDepartmentDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}
