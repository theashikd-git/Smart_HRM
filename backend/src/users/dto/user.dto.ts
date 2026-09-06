import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export enum RoleDto {
  ADMIN = 'ADMIN',
  HR = 'HR',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  EMPLOYEE = 'EMPLOYEE',
}

export class CreateUserDto {
  // Required for ADMIN/HR/MANAGER accounts. Omit for EMPLOYEE accounts --
  // email and password are derived automatically from the linked Employee
  // (see UsersService.create), so employees never have to be given one.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsEnum(RoleDto)
  role: RoleDto;

  // Required when role is EMPLOYEE -- links this login to an existing
  // Employee record (one account per employee). Optional for other roles:
  // a staff member can also be linked to their own Employee record, but
  // doesn't have to be.
  @IsOptional()
  @IsString()
  employeeId?: string;
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
