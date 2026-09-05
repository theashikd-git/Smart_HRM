import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateDeviceDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsNotEmpty()
  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  port?: number;
}

export class UpdateDeviceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsInt() @Min(1) port?: number;
}
