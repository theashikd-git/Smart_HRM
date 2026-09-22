import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

// class-validator only skips a validator for null/undefined, not "" --
// without this, a blank Email field on the Company Profile form (it's
// optional) would still fail @IsEmail() with "email must be an email".
const blankToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @Transform(blankToUndefined) @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() timeZone?: string;
  @IsOptional() @IsString() officeHours?: string;
  @IsOptional() @IsString() workingDays?: string;
}
