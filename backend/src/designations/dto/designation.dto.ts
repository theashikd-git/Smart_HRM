import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// A designation is a company-wide title. Which departments use it is set
// from the department (Organization > Department), not here.
export class CreateDesignationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsEnum(OrgUnitStatusDto)
  status?: OrgUnitStatusDto;
}

export class UpdateDesignationDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsEnum(OrgUnitStatusDto)
  status?: OrgUnitStatusDto;
}
