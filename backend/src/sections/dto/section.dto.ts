import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateSectionDto {
  @IsNotEmpty() @IsString() departmentId: string;
  @IsOptional() @IsString() subDepartmentId?: string;
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsString() code: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}

export class UpdateSectionDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() subDepartmentId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}
