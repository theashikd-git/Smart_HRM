import { IsDateString, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export enum RosterDayTypeDto {
  SHIFT = 'SHIFT',
  OFF = 'OFF',
}

export class RosterQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpsertRosterAssignmentDto {
  @IsEnum(RosterDayTypeDto)
  type: RosterDayTypeDto;

  // Required when type is SHIFT, ignored (cleared) when type is OFF -- the
  // service enforces this rather than a decorator so the error message can
  // name which field is missing and why.
  @ValidateIf((o) => o.type === RosterDayTypeDto.SHIFT)
  @IsString()
  shiftId?: string;

  // HR/Admin only, and only when they are changing an assignment that is
  // already APPROVED -- the service enforces that it's required in that
  // case, not this decorator, so the error can say exactly why.
  @IsOptional()
  @IsString()
  hrNote?: string;
}

export class ApproveRosterAssignmentDto {
  // Optional note from HR/Admin when first approving a MANAGER's pending
  // assignment -- unlike changing an already-approved one, a note isn't
  // required here since nothing is being overridden yet.
  @IsOptional()
  @IsString()
  note?: string;
}

export class RemoveRosterAssignmentDto {
  // Required only when clearing an assignment that is already APPROVED
  // and the actor is HR/Admin (a MANAGER can't clear one at all once it's
  // approved -- enforced in the service).
  @IsOptional()
  @IsString()
  hrNote?: string;
}
