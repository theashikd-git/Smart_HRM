import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum PolicyTypeDto {
  GRACE = 'GRACE',
  LATE = 'LATE',
}

export enum WindowUnitDto {
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
}

export class PolicyParamsDto {
  @IsEnum(WindowUnitDto) windowUnit: WindowUnitDto;
  @IsInt() @Min(1) @Max(366) windowSize: number;
  /** Free arrivals per window (GRACE). Use 0 for LATE. */
  @IsInt() @Min(0) @Max(1000) allowed: number;
  /** Every this many arrivals beyond `allowed` = 1 absent day. */
  @IsInt() @Min(1) @Max(1000) convertEvery: number;
  @IsBoolean() resetEnabled: boolean;
  /** null / omitted = reset at the end of each window. */
  @IsOptional() @IsInt() @Min(1) @Max(3660) resetAfterDays?: number | null;
}

export class PolicyScopeDto {
  @IsEnum(['INCLUDE', 'EXCLUDE']) kind: 'INCLUDE' | 'EXCLUDE';
  @IsEnum(['DEPARTMENT', 'DESIGNATION', 'EMPLOYEE']) targetType: 'DEPARTMENT' | 'DESIGNATION' | 'EMPLOYEE';
  @IsNotEmpty() @IsString() targetId: string;
}

export class CreatePolicyDto {
  @IsNotEmpty() @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsEnum(PolicyTypeDto) type: PolicyTypeDto;
  @ValidateNested() @Type(() => PolicyParamsDto) params: PolicyParamsDto;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PolicyScopeDto)
  scopes?: PolicyScopeDto[];
}

/**
 * Editing the name/description changes the policy in place. Editing the
 * rules or who it applies to starts a new version from `effectiveFrom`
 * (default: today), so earlier periods are never silently recalculated.
 */
export class UpdatePolicyDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @ValidateNested() @Type(() => PolicyParamsDto) params?: PolicyParamsDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PolicyScopeDto)
  scopes?: PolicyScopeDto[];
  @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class DeactivatePolicyDto {
  /** Last day the policy still applies (default: today). */
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class ActivatePolicyDto {
  /** Day the policy applies from again (default: today). */
  @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class RecalculateDto {
  @IsDateString() fromDate: string;
  @IsOptional() @IsString() employeeId?: string;
}

export class PolicyAbsenceQueryDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}
