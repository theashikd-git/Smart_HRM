import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum OrgUnitStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateGradeDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsInt() level?: number;
  @IsOptional() @IsNumber() minSalary?: number;
  @IsOptional() @IsNumber() maxSalary?: number;
  @IsOptional() @IsString() benefits?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}

export class UpdateGradeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() level?: number;
  @IsOptional() @IsNumber() minSalary?: number;
  @IsOptional() @IsNumber() maxSalary?: number;
  @IsOptional() @IsString() benefits?: string;
  @IsOptional() @IsEnum(OrgUnitStatusDto) status?: OrgUnitStatusDto;
}
