import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class CreateEmployeeCategoryDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  // Does this category accrue an anniversary-based leave balance
  // (Permanent/Contractual-style)? Off for a temporary/probationary
  // category that doesn't build up long-term balance.
  @IsOptional()
  @IsBoolean()
  accruesRollover?: boolean;

  // Is this a temporary status HR needs to revisit before it ends
  // (Provision's probation, Trial's trial period)?
  @IsOptional()
  @IsBoolean()
  hasFixedPeriod?: boolean;

  // Default length of that fixed period, in months -- only meaningful when
  // hasFixedPeriod is true. An individual employee's own Employee.trialMonths
  // overrides this when set.
  @ValidateIf((o) => o.hasFixedPeriod === true)
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultPeriodMonths?: number;
}

export class UpdateEmployeeCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  accruesRollover?: boolean;

  @IsOptional()
  @IsBoolean()
  hasFixedPeriod?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultPeriodMonths?: number;
}
