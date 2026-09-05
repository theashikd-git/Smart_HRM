import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum LeaveSessionDto {
  FULL_DAY = 'FULL_DAY',
  FIRST_HALF = 'FIRST_HALF',
  SECOND_HALF = 'SECOND_HALF',
}

export enum LeaveRequestStatusDto {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// ---------------------------------------------------------------------------
// Leave types
// ---------------------------------------------------------------------------

export class CreateLeaveTypeDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  daysPerYear?: number;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCarryForwardDays?: number;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateLeaveTypeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsNumber() @Min(0) daysPerYear?: number;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsBoolean() carryForward?: boolean;
  @IsOptional() @IsNumber() @Min(0) maxCarryForwardDays?: number;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

export class CreateLeaveRequestDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  leaveTypeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(LeaveSessionDto)
  session?: LeaveSessionDto;

  @IsOptional()
  @IsString()
  reason?: string;

  // ADMIN/HR override to approve past a member's remaining balance (e.g.
  // maternity/compassionate leave beyond normal entitlement). Ignored for
  // callers without permission to bypass the balance check -- enforced in
  // the controller via role guard on this being present, not here.
  @IsOptional()
  @IsBoolean()
  overrideBalance?: boolean;
}

export class RejectLeaveRequestDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class LeaveQueryDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() leaveTypeId?: string;
  @IsOptional() @IsEnum(LeaveRequestStatusDto) status?: LeaveRequestStatusDto;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

// ---------------------------------------------------------------------------
// Leave balances
// ---------------------------------------------------------------------------

export class AdjustLeaveBalanceDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  leaveTypeId: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  allocated?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carriedForward?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class InitializeBalancesDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  // Restrict initialization to one leave type; omit to initialize every
  // active leave type for every active employee.
  @IsOptional()
  @IsString()
  leaveTypeId?: string;
}
