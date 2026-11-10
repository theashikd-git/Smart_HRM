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

  // Department this shift belongs to. Required when creating (enforced in
  // ShiftsService); only HR/Admin create/edit shifts. Older shifts with no
  // department stay "General" and are usable by every department.
  @IsOptional()
  @IsString()
  departmentId?: string;
}
