import { ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
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
  @IsEnum(OrgUnitStatusDto)
  status?: OrgUnitStatusDto;
  // The designations this department uses. When sent, it replaces the whole
  // list (an empty array clears it); leave it out to keep the current links.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  designationIds?: string[];
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
  @IsEnum(OrgUnitStatusDto)
  status?: OrgUnitStatusDto;
  // The designations this department uses. When sent, it replaces the whole
  // list (an empty array clears it); leave it out to keep the current links.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  designationIds?: string[];
}
