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
}
