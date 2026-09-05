import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum LocationTypeDto {
  FACTORY = 'FACTORY',
  OFFICE = 'OFFICE',
  SITE = 'SITE',
  PROJECT = 'PROJECT',
  OTHER = 'OTHER',
}

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateLocationDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsEnum(LocationTypeDto) type?: LocationTypeDto;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}

export class UpdateLocationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(LocationTypeDto) type?: LocationTypeDto;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}
