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

// Mirrors Prisma's LeaveSpecialRule enum. NONE is the ordinary
// balance-and-approve flow; COMPENSATORY and MATERNITY each have their own
// eligibility check in LeaveService.create beyond the normal balance check.
export enum LeaveSpecialRuleDto {
  NONE = 'NONE',
  COMPENSATORY = 'COMPENSATORY',
  MATERNITY = 'MATERNITY',
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

  // NONE (default) for an ordinary leave type. COMPENSATORY/MATERNITY opt
  // this leave type into the matching special eligibility check instead of
  // (COMPENSATORY) or in addition to (MATERNITY) the normal balance check.
  @IsOptional()
  @IsEnum(LeaveSpecialRuleDto)
  specialRule?: LeaveSpecialRuleDto;
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
  @IsOptional() @IsEnum(LeaveSpecialRuleDto) specialRule?: LeaveSpecialRuleDto;
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

  // Required when leaveType.specialRule === COMPENSATORY: the past on-duty
  // date this compensatory day is being claimed against. Checked in
  // LeaveService.create against that date's AttendanceRecord.
  @IsOptional()
  @IsDateString()
  compensatoryForDate?: string;

  // Required when leaveType.specialRule === MATERNITY: the uploaded
  // supporting document's id (see the leave attachments upload endpoint),
  // stored as LeaveRequest.attachmentId.
  @IsOptional()
  @IsString()
  attachmentId?: string;
}

export class RejectLeaveRequestDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

// Body for requesting cancellation of an already-APPROVED leave (see
// LeaveController.cancelMyRequest / LeaveService.requestCancellation) --
// reason is optional, unlike rejecting a request, since the employee is
// cancelling their own leave rather than turning someone else's down.
export class RequestCancellationDto {
  @IsOptional()
  @IsString()
  reason?: string;
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

  // Restrict initialization to one employee (e.g. right after they're
  // created, or after their leave category changes); omit to sweep every
  // active employee.
  @IsOptional()
  @IsString()
  employeeId?: string;
}

// ---------------------------------------------------------------------------
// Leave category policies -- per (employee category, leave type) entitlement,
// admin-configurable rather than seeded/hardcoded. LeaveService's balance
// allocator looks these rows up instead of LeaveType.daysPerYear whenever an
// employee has a leaveCategory set.
// ---------------------------------------------------------------------------

export class CreateLeaveCategoryPolicyDto {
  @IsNotEmpty()
  @IsString()
  leaveCategoryId: string;

  @IsNotEmpty()
  @IsString()
  leaveTypeId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  daysPerCycle: number;

  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCarryForwardDays?: number;

  // Contractual's "carry forward once, then stop adding" rule: when true,
  // the carry-forward only happens on the first anniversary and never again
  // after that.
  @IsOptional()
  @IsBoolean()
  carryForwardOnce?: boolean;
}

export class UpdateLeaveCategoryPolicyDto {
  @IsOptional() @IsNumber() @Min(0) daysPerCycle?: number;
  @IsOptional() @IsBoolean() carryForward?: boolean;
  @IsOptional() @IsNumber() @Min(0) maxCarryForwardDays?: number;
  @IsOptional() @IsBoolean() carryForwardOnce?: boolean;
}

// One-step version used by the Leave Policy screen's inline "+ Add Leave"
// under an employee-type section: names a leave (existing or brand new --
// LeaveCategoryPolicyService looks it up by name and creates it if it
// doesn't exist yet) and its entitlement for that category in a single
// call, instead of requiring a separate trip to Leave Type first.
export class QuickAddLeaveCategoryPolicyDto {
  @IsNotEmpty()
  @IsString()
  leaveCategoryId: string;

  @IsNotEmpty()
  @IsString()
  leaveName: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  daysPerCycle: number;

  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCarryForwardDays?: number;

  @IsOptional()
  @IsBoolean()
  carryForwardOnce?: boolean;
}
