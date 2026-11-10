import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
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

// One staged edit from the Roster screen. The screen collects every change
// locally (assign / day off / clear / random off) and only sends them all
// together when the manager presses Save.
export class RosterChangeDto {
  @IsString()
  employeeId: string;

  @IsDateString()
  date: string;

  @IsIn(['SET', 'CLEAR'])
  action: 'SET' | 'CLEAR';

  @ValidateIf((o) => o.action === 'SET')
  @IsEnum(RosterDayTypeDto)
  type?: RosterDayTypeDto;

  @ValidateIf((o) => o.action === 'SET' && o.type === RosterDayTypeDto.SHIFT)
  @IsString()
  shiftId?: string;

  // Required for a date that has already passed (same rule as a single edit).
  @IsOptional()
  @IsString()
  hrNote?: string;
}

export class BatchRosterDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => RosterChangeDto)
  changes: RosterChangeDto[];
}
