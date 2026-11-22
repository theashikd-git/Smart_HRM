import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateShiftDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm 24h format' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm 24h format' })
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  weekendRule?: string;

  @IsOptional()
  @IsString()
  overtimeRule?: string;

  // FIXED (default) uses start/end time and grace. FLEXIBLE has no start
  // time: the day needs `requiredHours` worked and never shows GRACE/LATE.
  @IsOptional()
  @IsEnum(['FIXED', 'FLEXIBLE'])
  shiftType?: 'FIXED' | 'FLEXIBLE';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(24)
  requiredHours?: number | null;

  // Department this shift belongs to. Required when creating (enforced in
  // ShiftsService); only HR/Admin create/edit shifts. Older shifts with no
  // department stay "General" and are usable by every department.
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm 24h format' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm 24h format' })
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  weekendRule?: string;

  @IsOptional()
  @IsString()
  overtimeRule?: string;

  // FIXED (default) uses start/end time and grace. FLEXIBLE has no start
  // time: the day needs `requiredHours` worked and never shows GRACE/LATE.
  @IsOptional()
  @IsEnum(['FIXED', 'FLEXIBLE'])
  shiftType?: 'FIXED' | 'FLEXIBLE';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(24)
  requiredHours?: number | null;

  // Department this shift belongs to. Required when creating (enforced in
  // ShiftsService); only HR/Admin create/edit shifts. Older shifts with no
  // department stay "General" and are usable by every department.
  @IsOptional()
  @IsString()
  departmentId?: string;
}
