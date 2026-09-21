export type Role = 'ADMIN' | 'MANAGING_DIRECTOR' | 'HR' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string;
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
export interface Department {
  id: string;
  name: string;
  code: string;
  headEmployeeId?: string | null;
  status: OrgUnitStatus;
  manager?: { id: string; fullName: string } | null;
  _count?: { employees: number };
  approvalWorkflow?: LeaveApprovalWorkflow | null;
}

export interface DepartmentSuperior {
  id: string;
  title: string;
  departmentId?: string | null;
  employeeId: string;
  employee?: { id: string; fullName: string; employeeCode: string } | null;
  department?: { id: string; name: string } | null;
  createdAt?: string;
}

export interface Designation {
  id: string;
  title: string;
  departmentId?: string | null;
  status: OrgUnitStatus;
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

export type RosterDayType = 'SHIFT' | 'OFF';

export interface RosterAssignment {
  id: string;
  employeeId: string;
  date: string;
  type: RosterDayType;
  shiftId?: string | null;
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
}

export interface RosterEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  department?: { id: string; name: string } | null;
  subDepartment?: { id: string; name: string } | null;
  designation?: { title: string } | null;
}

export interface RosterAttendanceEntry {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
}

export interface RosterWeekData {
  employees: RosterEmployee[];
  assignments: RosterAssignment[];
  attendance: RosterAttendanceEntry[];
}

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
export type SyncStatus = 'NOT_SYNCED' | 'PENDING' | 'SYNCED' | 'FAILED';
// Picked on the Add/Edit Employee form. EMPLOYEE/MANAGER/SUPERVISOR/
// MANAGING_DIRECTOR each grant that same real access level (Role, below)
// via an Employee ID login -- Manager here is exactly as real as a Manager
// created from System Settings > Add Staff User with a separate username/
// password, just signed in with the Employee ID instead. ADMINISTRATOR is
// the one value that provisions a traditional staff login instead.
export type EmployeeRole = 'EMPLOYEE' | 'MANAGER' | 'SUPERVISOR' | 'MANAGING_DIRECTOR' | 'ADMINISTRATOR';

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
  // Which employee-type track this employee is on -- required at creation.
  // These are no longer a fixed 4-value enum: HR can create/rename categories
  // via the Employee Categories admin screen, so leaveCategoryId points at a
  // real EmployeeCategory row. trialMonths is only relevant when that
  // category's hasFixedPeriod is true and it has no defaultPeriodMonths (HR
  // must then pick a length per employee -- Trial's original design).
  // categorySince anchors that category's own clock (set from joiningDate
  // at creation, reset to the change date whenever HR changes the category).
  leaveCategoryId?: string | null;
  leaveCategory?: EmployeeCategory | null;
  trialMonths?: number | null;
  categorySince?: string | null;
  // Job-title-style label, defaults to EMPLOYEE. See the EmployeeRole type
  // above for what it does and doesn't control.
  employeeRole?: EmployeeRole;
}

// HR-editable employee-type category (Permanent/Provision/Contractual/Trial
// by default, but HR can add more or rename these). The behavior flags are
// what LeaveSchedulerService reads instead of hardcoding category names:
//  - accruesRollover: gets an anniversary-based leave balance rollover.
//  - hasFixedPeriod: has a probation/trial-style period that HR gets an
//    Audit Log heads-up about 2 weeks before it ends.
//  - defaultPeriodMonths: that period's length, when every employee in this
//    category shares one (e.g. Provision's fixed 6 months). Leave it unset
//    for a category where HR picks the length per employee (Trial) --
//    Employee.trialMonths is then required per hire.
export interface EmployeeCategory {
  id: string;
  name: string;
  code: string;
  accruesRollover: boolean;
  hasFixedPeriod: boolean;
  defaultPeriodMonths?: number | null;
  isActive: boolean;
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
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  employeeId?: string | null;
  employee?: { id: string; employeeCode: string; fullName: string } | null;
}

export type LeaveSpecialRule = 'NONE' | 'COMPENSATORY' | 'MATERNITY';

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
  // NONE (default) for an ordinary leave type. COMPENSATORY/MATERNITY opt
  // this leave type into its own eligibility check in LeaveService.create
  // instead of (COMPENSATORY) or in addition to (MATERNITY) the normal
  // pooled-balance check.
  specialRule: LeaveSpecialRule;
}

// Per (employee category, leave type) entitlement -- admin-configurable
// rather than hardcoded, since the 7-type leave policy's day counts differ
// by employee category (e.g. Permanent Casual = 10, Provision Casual = 5).
export interface LeaveCategoryPolicy {
  id: string;
  leaveCategoryId: string;
  leaveCategory: EmployeeCategory;
  leaveTypeId: string;
  leaveType: LeaveType;
  daysPerCycle: number;
  carryForward: boolean;
  maxCarryForwardDays?: number | null;
  carryForwardOnce: boolean;
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
  /** Only set on items returned by /leave/my/approvals (see useMyApprovals):
   *  true when this signed-in login can act on the request right now, false
   *  when it's showing up purely as a past-decision record of theirs.
   *  Absent on every other endpoint's LeaveRequest rows. */
  canDecide?: boolean;
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

export interface MyTeamMember {
  id: string;
  fullName: string;
  employeeCode: string;
  photo?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  status: AttendanceStatus;
  present: boolean;
}

// "My Team" dashboard panel -- populated only when the signed-in user is
// set as the head of one or more departments (see backend DashboardService
// .myTeamAttendance). isManager: false means the panel should stay hidden.
export interface MyTeamAttendance {
  isManager: boolean;
  departments: string[];
  members: MyTeamMember[];
}

// One raw punch event for the "Real-Time Monitor" panel -- see
// DashboardService.myTeamRecentPunches. direction mirrors AttendanceLog
// .inOutMode ("IN" | "OUT" | "BREAK_OUT" | "BREAK_IN"), null for an
// unrecognized punch.
export interface MyTeamPunch {
  id: string;
  employeeId: string;
  fullName: string;
  employeeCode: string;
  deviceName: string | null;
  timestamp: string;
  direction: string | null;
}

export interface MyTeamRecentPunches {
  isManager: boolean;
  punches: MyTeamPunch[];
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

export type NotificationCategory = 'LEAVE' | 'SHIFT';

export interface AppNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
