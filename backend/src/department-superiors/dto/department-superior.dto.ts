import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentSuperiorDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsNotEmpty() @IsString() employeeId: string;
  @IsNotEmpty() @IsString() title: string;
}
