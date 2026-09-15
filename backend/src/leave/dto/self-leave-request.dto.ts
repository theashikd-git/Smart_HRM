import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeaveSessionDto } from './leave.dto';

/** Same shape as CreateLeaveRequestDto but without employeeId (always the
 *  caller's own record, from their linked Employee) or overrideBalance
 *  (employees can never bypass their own balance check). */
export class SelfCreateLeaveRequestDto {
  @IsNotEmpty()
  @IsString()
  leaveTypeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(LeaveSessionDto)
  session?: LeaveSessionDto;

  @IsOptional()
  @IsString()
  reason?: string;

  // Required when leaveType.specialRule === COMPENSATORY: the past on-duty
  // date this compensatory day is being claimed against.
  @IsOptional()
  @IsDateString()
  compensatoryForDate?: string;

  // Required when leaveType.specialRule === MATERNITY: the uploaded
  // supporting document's id.
  @IsOptional()
  @IsString()
  attachmentId?: string;
}
