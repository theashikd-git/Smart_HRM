export type Role = 'ADMIN' | 'HR' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  // True right after an auto-provisioned employee login's first sign-in --
  // the employee portal blocks on a "set a new password" screen until
  // it's cleared via /auth/change-password.
  mustChangePassword?: boolean;
}

export type OrgUnitStatus = 'ACTIVE' | 'INACTIVE';
export type LocationType = 'FACTORY' | 'OFFICE' | 'SITE' | 'PROJECT' | 'OTHER';

export interface Branch {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  managerId?: string | null;
  status: OrgUnitStatus;
  manager?: { id: string; fullName: string } | null;
  _count?: { employees: number; departments: number; locations: number };
}

export interface Location {
  id: string;
  name: string;
  code?: string | null;
  type: LocationType;
  address?: string | null;
  branchId?: string | null;
  status: OrgUnitStatus;
  branch?: { id: string; name: string } | null;
  _count?: { employees: number; departments: number };
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headEmployeeId?: string | null;
  branchId?: string | null;
  locationId?: string | null;
  status: OrgUnitStatus;
  branch?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
  _count?: { employees: number };
  approvalWorkflow?: LeaveApprovalWorkflow | null;
}

export interface SubDepartment {
  id: string;
  name: string;
  code?: string | null;
  departmentId: string;
  status: OrgUnitStatus;
  department?: { id: string; name: string } | null;
  _count?: { employees: number };
}

export interface Section {
  id: string;
  name: string;
  code?: string | null;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  status: OrgUnitStatus;
  department?: { id: string; name: string } | null;
  subDepartment?: { id: string; name: string } | null;
  _count?: { employees: number };
}

export interface Grade {
  id: string;
  name: string;
  level?: number | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  benefits?: string | null;
  status: OrgUnitStatus;
  _count?: { designations: number };
}

export interface DepartmentSuperior {
  id: string;
  title: string;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  employeeId: string;
  employee?: { id: string; fullName: string; employeeCode: string } | null;
  department?: { id: string; name: string } | null;
  subDepartment?: { id: string; name: string } | null;
  createdAt?: string;
}

export interface Designation {
  id: string;
  title: string;
  gradeId?: string | null;
  departmentId?: string | null;
  status: OrgUnitStatus;
  grade?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  _count?: { employees: number };
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  weekendRule?: string | null;
  overtimeRule?: string | null;
  _count?: { employees: number };
}

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
export type SyncStatus = 'NOT_SYNCED' | 'PENDING' | 'SYNCED' | 'FAILED';

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  photo?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationalId?: string | null;
  passport?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  joiningDate?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  shiftId?: string | null;
  employmentType: EmploymentType;
  salary?: number | null;
  status: EmployeeStatus;
  deviceUserId?: string | null;
  syncStatus: SyncStatus;
  lastSyncDate?: string | null;
  fingerprintEnrolled: boolean;
  faceEnrolled: boolean;
  rfidEnrolled: boolean;
  rfidCardNumber?: string | null;
  department?: { id: string; name: string; code: string } | null;
  designation?: { id: string; title: string } | null;
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
  createdAt?: string;
  // This employee's own login account, if any -- lets the Employee profile
  // screen show/change their access level (Employee/Supervisor/Manager)
  // directly, instead of a separate trip to System Settings.
  account?: { id: string; role: Role; isActive: boolean } | null;
}

export type DeviceConnectionStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface Device {
  id: string;
  name: string;
  deviceModel: string;
  ipAddress: string;
  port: number;
  serialNumber?: string | null;
  firmwareVersion?: string | null;
  connectionStatus: DeviceConnectionStatus;
  lastCommunication?: string | null;
  deviceTime?: string | null;
  storageUsed?: number | null;
}

export interface DeviceUser {
  deviceUserId: string;
  name: string;
  cardNumber?: string;
  hasFingerprint: boolean;
  hasFace: boolean;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workHours?: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
  approved: boolean;
  notes?: string | null;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    department?: { name: string } | null;
    shift?: { name: string; startTime: string; endTime: string } | null;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SystemUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  employeeId?: string | null;
  employee?: { id: string; employeeCode: string; fullName: string } | null;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  daysPerYear: number;
  paid: boolean;
  carryForward: boolean;
  maxCarryForwardDays?: number | null;
  requiresApproval: boolean;
  color?: string | null;
  isActive: boolean;
}

export type LeaveSession = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type LeaveTierType = 'REPORTING_SUPERIOR' | 'SPECIFIC_USER';

export interface LeaveApprovalTier {
  id: string;
  order: number;
  label: string;
  type: LeaveTierType;
  approverUserId?: string | null;
  approver?: { id: string; fullName: string; role: Role } | null;
}

export interface LeaveApprovalWorkflow {
  id: string;
  departmentId: string;
  isActive: boolean;
  tiers: LeaveApprovalTier[];
}

export interface LeaveApprovalDecision {
  id: string;
  tierOrder: number;
  tierLabel: string;
  decision: 'APPROVED' | 'REJECTED';
  reason?: string | null;
  decidedAt: string;
  approver?: { id: string; fullName: string } | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  session: LeaveSession;
  totalDays: number;
  reason?: string | null;
  status: LeaveRequestStatus;
  rejectionReason?: string | null;
  decidedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  // Tier-chain state -- set only while a tiered workflow is driving this
  // request (see LeaveApprovalWorkflow). currentTierLabel is the tier whose
  // decision is next needed; both are null once the request leaves PENDING
  // or when its department has no configured workflow.
  currentTierOrder?: number | null;
  currentTierLabel?: string | null;
  decisions?: LeaveApprovalDecision[];
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    department?: { name: string } | null;
  };
  leaveType?: { id: string; name: string; code: string; color?: string | null; paid: boolean };
  appliedBy?: { id: string; fullName: string } | null;
  decidedBy?: { id: string; fullName: string } | null;
}

export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  color?: string | null;
  paid: boolean;
  year: number;
  allocated: number;
  carriedForward: number;
  used: number;
  remaining: number;
}

export interface DashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  deviceStatus: DeviceConnectionStatus;
  deviceName: string | null;
  recentActivity: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
  user?: { fullName: string; email: string } | null;
}
