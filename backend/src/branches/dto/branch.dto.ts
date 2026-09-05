import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateBranchDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsString() code: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}
