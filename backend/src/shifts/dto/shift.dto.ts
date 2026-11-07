import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

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

  // Department this shift belongs to. Omit/null = a "General" shift usable
  // by every department. A MANAGER/SUPERVISOR's own value here is ignored
  // and replaced with their own department -- see ShiftsService.
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

  // Department this shift belongs to. Omit/null = a "General" shift usable
  // by every department. A MANAGER/SUPERVISOR's own value here is ignored
  // and replaced with their own department -- see ShiftsService.
  @IsOptional()
  @IsString()
  departmentId?: string;
}
