import { IsEmail, IsEnum, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export enum RoleDto {
  ADMIN = 'ADMIN',
  HR = 'HR',
  MANAGER = 'MANAGER',
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  fullName: string;

  @MinLength(6)
  password: string;

  @IsEnum(RoleDto)
  role: RoleDto;
}

export class UpdateUserDto {
  @IsOptional()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsEnum(RoleDto)
  role?: RoleDto;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @MinLength(6)
  password?: string;
}
