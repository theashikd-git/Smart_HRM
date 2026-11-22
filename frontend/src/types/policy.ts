// Attendance policies (Personnel > Organization > Policy).

export type PolicyType = 'GRACE' | 'LATE';
export type PolicyWindowUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type PolicyScopeKind = 'INCLUDE' | 'EXCLUDE';
export type PolicyTargetType = 'DEPARTMENT' | 'DESIGNATION' | 'EMPLOYEE';

export interface PolicyParams {
  windowUnit: PolicyWindowUnit;
  windowSize: number;
  /** Free arrivals per window (Grace). Always 0 for Late. */
  allowed: number;
  /** Every this many arrivals beyond `allowed` = 1 absent day. */
  convertEvery: number;
  resetEnabled: boolean;
  /** null = the counter resets at the end of each window. */
  resetAfterDays?: number | null;
}

export interface PolicyScope {
  kind: PolicyScopeKind;
  targetType: PolicyTargetType;
  targetId: string;
}

export interface AttendancePolicy {
  id: string;
  name: string;
  description?: string | null;
  type: PolicyType;
  params: PolicyParams;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  scopes: (PolicyScope & { id?: string })[];
}

export interface PolicyPayload {
  name: string;
  description?: string;
  type?: PolicyType;
  params: PolicyParams;
  scopes: PolicyScope[];
  effectiveFrom?: string;
}

export interface PolicyCounter {
  policyId: string;
  name: string;
  type: PolicyType;
  windowStart: string;
  windowEnd: string;
  inWindow: number;
  periodStart: string;
  pending: number;
  absencesInPeriod: number;
}

export interface PolicyAbsenceRow {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  policyName: string;
  type: PolicyType;
  /** e.g. "Policy absent (3 late)" or "Policy absent (grace)" */
  label: string;
  occurrenceDates: string[];
}
