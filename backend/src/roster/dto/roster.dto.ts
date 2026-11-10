import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

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

  // Required only when the date being assigned has already passed -- the
  // service enforces that, not this decorator, so the error can say why.
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
  // Required only when the date being cleared has already passed. For
  // HR/Admin it clears the entry right away; for MANAGER/SUPERVISOR it
  // instead files a removal request awaiting HR/Admin's approval (see
  // RosterService.remove/approve).
  @IsOptional()
  @IsString()
  hrNote?: string;
}

// Assign the same duty to many employees across a date range in one go
// (the Roster's "Assign Multiple" tool) -- so a whole month can be filled
// in a few clicks instead of one cell at a time.
export class BulkAssignRosterDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  employeeIds: string[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(RosterDayTypeDto)
  type: RosterDayTypeDto;

  @ValidateIf((o) => o.type === RosterDayTypeDto.SHIFT)
  @IsString()
  shiftId?: string;

  // Only these weekdays inside the range get the duty (0 = Sunday ...
  // 6 = Saturday, same as JS getDay()). Omit/empty = every day.
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  // true = leave days that already have a duty alone, only fill the gaps.
  @IsOptional()
  @IsBoolean()
  skipExisting?: boolean;

  // Required when the range includes a date that has already passed --
  // same rule as a single past-date change (see RosterService.upsert).
  @IsOptional()
  @IsString()
  hrNote?: string;
}
