import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum HolidayTypeDto {
  GOVERNMENT = 'GOVERNMENT',
  COMPANY = 'COMPANY',
}

export class CreateHolidayDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsEnum(HolidayTypeDto)
  type?: HolidayTypeDto;
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(HolidayTypeDto)
  type?: HolidayTypeDto;
}
