import { IsArray, IsBoolean, IsOptional } from 'class-validator';

export interface LeaveApprovalTierInput {
  order: number;
  label: string;
  type: 'REPORTING_SUPERIOR' | 'SPECIFIC_USER';
  // Required when type is SPECIFIC_USER; validated in the service (kept
  // loose here rather than nested class-validator, so the tier list can be
  // freely reordered/added/removed from the admin screen without needing a
  // class-transformer setup for nested array validation).
  approverUserId?: string;
}

export class SaveLeaveWorkflowDto {
  @IsArray()
  tiers: LeaveApprovalTierInput[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
