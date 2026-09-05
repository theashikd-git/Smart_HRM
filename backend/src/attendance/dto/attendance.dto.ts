import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum AttendanceStatusDto {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
  HOLIDAY = 'HOLIDAY',
}

export class ManualPunchDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsDateString()
  timestamp: string;

  @IsNotEmpty()
  @IsEnum(['IN', 'OUT'])
  direction: 'IN' | 'OUT';
}

export class CorrectAttendanceDto {
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsEnum(AttendanceStatusDto) status?: AttendanceStatusDto;
  @IsOptional() @IsString() notes?: string;
}

export class AttendanceQueryDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(AttendanceStatusDto) status?: AttendanceStatusDto;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

export class ApproveAttendanceDto {
  @IsBoolean()
  approved: boolean;
}
