import { IsNotEmpty } from 'class-validator';

export class EmployeeLoginDto {
  @IsNotEmpty()
  employeeCode: string;

  @IsNotEmpty()
  password: string;
}
