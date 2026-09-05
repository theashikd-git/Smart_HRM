// Mock data for the Personnel module workbench prototype.
// Nothing here touches the real API — this is for shell/navigation demo purposes only.

export const dashboardSummary = {
  totalEmployees: 1248,
  presentToday: 1086,
  absentToday: 82,
  lateToday: 46,
  onLeave: 34,
  overtime: 27,
  resigned: 19,
};

export const attendanceOverview = [
  { label: 'Present', value: 87, color: 'success' as const },
  { label: 'Late', value: 4, color: 'warning' as const },
  { label: 'Absent', value: 6, color: 'danger' as const },
  { label: 'Leave', value: 3, color: 'info' as const },
];

export const attendanceTrend = [
  { date: 'Aug 11', present: 1042, absent: 98, late: 52 },
  { date: 'Aug 12', present: 1061, absent: 90, late: 48 },
  { date: 'Aug 13', present: 1078, absent: 85, late: 44 },
  { date: 'Aug 14', present: 1015, absent: 112, late: 61 },
  { date: 'Aug 15', present: 1002, absent: 120, late: 58 },
  { date: 'Aug 16', present: 1071, absent: 88, late: 47 },
  { date: 'Aug 17', present: 1086, absent: 82, late: 46 },
];

export const departmentAttendance = [
  { department: 'Production', total: 420, present: 368, absent: 28, late: 18, leave: 6, ot: 12 },
  { department: 'Quality Control', total: 96, present: 84, absent: 6, late: 4, leave: 2, ot: 3 },
  { department: 'Human Resources', total: 32, present: 30, absent: 1, late: 1, leave: 0, ot: 0 },
  { department: 'Finance', total: 44, present: 41, absent: 2, late: 1, leave: 0, ot: 1 },
  { department: 'IT', total: 38, present: 34, absent: 2, late: 2, leave: 0, ot: 4 },
  { department: 'Administration', total: 52, present: 48, absent: 2, late: 2, leave: 0, ot: 1 },
  { department: 'Sales', total: 66, present: 58, absent: 4, late: 3, leave: 1, ot: 2 },
];

export const pendingApprovals = [
  { id: 'leave', label: 'Leave Requests', count: 12 },
  { id: 'correction', label: 'Attendance Corrections', count: 5 },
  { id: 'overtime', label: 'Overtime Requests', count: 8 },
  { id: 'roster', label: 'Roster Changes', count: 3 },
];

export type RosterStatus = 'Present' | 'Late' | 'Absent' | 'Leave' | 'Off';

export const todaysRoster: {
  employee: string;
  employeeId: string;
  department: string;
  shift: string;
  start: string;
  end: string;
  status: RosterStatus;
}[] = [
  { employee: 'Rahim Ahmed', employeeId: 'EMP-1001', department: 'Production', shift: 'Morning', start: '08:00', end: '17:00', status: 'Present' },
  { employee: 'Karim Hasan', employeeId: 'EMP-1025', department: 'Finance', shift: 'Morning', start: '08:00', end: '17:00', status: 'Late' },
  { employee: 'Hasan Ali', employeeId: 'EMP-1088', department: 'IT', shift: 'Morning', start: '08:00', end: '17:00', status: 'Late' },
  { employee: 'Fatima Begum', employeeId: 'EMP-1102', department: 'Human Resources', shift: 'Morning', start: '08:00', end: '17:00', status: 'Present' },
  { employee: 'Nasir Uddin', employeeId: 'EMP-1140', department: 'Production', shift: 'Night', start: '20:00', end: '05:00', status: 'Present' },
  { employee: 'Shirin Akter', employeeId: 'EMP-1156', department: 'Sales', shift: 'Morning', start: '09:00', end: '18:00', status: 'Leave' },
  { employee: 'Jamal Uddin', employeeId: 'EMP-1178', department: 'Quality Control', shift: 'Morning', start: '08:00', end: '17:00', status: 'Absent' },
  { employee: 'Rina Sultana', employeeId: 'EMP-1201', department: 'Administration', shift: 'Morning', start: '09:00', end: '18:00', status: 'Off' },
];

export const recentActivity = [
  { time: '10:42 AM', text: 'Leave approved for EMP-1025' },
  { time: '10:18 AM', text: 'Roster updated for Production' },
  { time: '09:55 AM', text: 'Attendance corrected for EMP-1088' },
  { time: '09:30 AM', text: 'New employee added' },
  { time: '09:05 AM', text: 'Overtime request submitted for EMP-1140' },
  { time: '08:47 AM', text: 'Shift assigned for Quality Control' },
];

// ---------------------------------------------------------------------------
// Reports program mock data
// ---------------------------------------------------------------------------

export interface LateReportRow {
  employee: string;
  employeeId: string;
  department: string;
  shift: string;
  scheduledIn: string;
  actualIn: string;
  lateMinutes: number;
  status: 'Late';
}

export const lateReportRows: LateReportRow[] = [
  { employee: 'Rahim Ahmed', employeeId: 'EMP-1001', department: 'Production', shift: 'Morning', scheduledIn: '08:00', actualIn: '08:12', lateMinutes: 12, status: 'Late' },
  { employee: 'Karim Hasan', employeeId: 'EMP-1025', department: 'Finance', shift: 'Morning', scheduledIn: '08:00', actualIn: '08:18', lateMinutes: 18, status: 'Late' },
  { employee: 'Hasan Ali', employeeId: 'EMP-1088', department: 'IT', shift: 'Morning', scheduledIn: '08:00', actualIn: '08:25', lateMinutes: 25, status: 'Late' },
  { employee: 'Nasima Khatun', employeeId: 'EMP-1112', department: 'Sales', shift: 'Morning', scheduledIn: '09:00', actualIn: '09:09', lateMinutes: 9, status: 'Late' },
  { employee: 'Abdul Karim', employeeId: 'EMP-1134', department: 'Production', shift: 'Morning', scheduledIn: '08:00', actualIn: '08:31', lateMinutes: 31, status: 'Late' },
];

export interface AbsentReportRow {
  employee: string;
  employeeId: string;
  department: string;
  shift: string;
  scheduledIn: string;
  reason: string;
  status: 'Absent';
}

export const absentReportRows: AbsentReportRow[] = [
  { employee: 'Jamal Uddin', employeeId: 'EMP-1178', department: 'Quality Control', shift: 'Morning', scheduledIn: '08:00', reason: 'Not reported', status: 'Absent' },
  { employee: 'Sultana Razia', employeeId: 'EMP-1190', department: 'Production', shift: 'Morning', scheduledIn: '08:00', reason: 'No leave on file', status: 'Absent' },
  { employee: 'Mizanur Rahman', employeeId: 'EMP-1203', department: 'Administration', shift: 'Morning', scheduledIn: '09:00', reason: 'Not reported', status: 'Absent' },
];

export interface OvertimeReportRow {
  employee: string;
  employeeId: string;
  department: string;
  shift: string;
  scheduledOut: string;
  actualOut: string;
  overtimeMinutes: number;
  status: 'Overtime';
}

export const overtimeReportRows: OvertimeReportRow[] = [
  { employee: 'Nasir Uddin', employeeId: 'EMP-1140', department: 'Production', shift: 'Night', scheduledOut: '05:00', actualOut: '06:10', overtimeMinutes: 70, status: 'Overtime' },
  { employee: 'Hasan Ali', employeeId: 'EMP-1088', department: 'IT', shift: 'Morning', scheduledOut: '17:00', actualOut: '18:45', overtimeMinutes: 105, status: 'Overtime' },
  { employee: 'Rina Sultana', employeeId: 'EMP-1201', department: 'Administration', shift: 'Morning', scheduledOut: '18:00', actualOut: '18:40', overtimeMinutes: 40, status: 'Overtime' },
];

export interface PresentReportRow {
  employee: string;
  employeeId: string;
  department: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  status: 'Present';
}

export const presentReportRows: PresentReportRow[] = [
  { employee: 'Rahim Ahmed', employeeId: 'EMP-1001', department: 'Production', shift: 'Morning', checkIn: '08:00', checkOut: '17:02', status: 'Present' },
  { employee: 'Fatima Begum', employeeId: 'EMP-1102', department: 'Human Resources', shift: 'Morning', checkIn: '07:56', checkOut: '17:05', status: 'Present' },
  { employee: 'Shirin Akter', employeeId: 'EMP-1156', department: 'Sales', shift: 'Morning', checkIn: '08:58', checkOut: '18:03', status: 'Present' },
];

export interface EarlyOutReportRow {
  employee: string;
  employeeId: string;
  department: string;
  shift: string;
  scheduledOut: string;
  actualOut: string;
  earlyMinutes: number;
  status: 'Early Out';
}

export const earlyOutReportRows: EarlyOutReportRow[] = [
  { employee: 'Nasima Khatun', employeeId: 'EMP-1112', department: 'Sales', shift: 'Morning', scheduledOut: '18:00', actualOut: '17:20', earlyMinutes: 40, status: 'Early Out' },
  { employee: 'Abdul Karim', employeeId: 'EMP-1134', department: 'Production', shift: 'Morning', scheduledOut: '17:00', actualOut: '16:35', earlyMinutes: 25, status: 'Early Out' },
];

export interface MissingPunchReportRow {
  employee: string;
  employeeId: string;
  department: string;
  shift: string;
  missingPunch: 'Check-in' | 'Check-out';
  status: 'Missing Punch';
}

export const missingPunchReportRows: MissingPunchReportRow[] = [
  { employee: 'Mizanur Rahman', employeeId: 'EMP-1203', department: 'Administration', shift: 'Morning', missingPunch: 'Check-out', status: 'Missing Punch' },
  { employee: 'Sultana Razia', employeeId: 'EMP-1190', department: 'Production', shift: 'Morning', missingPunch: 'Check-in', status: 'Missing Punch' },
];

export const reportDepartments = ['All Departments', 'Production', 'Quality Control', 'Human Resources', 'Finance', 'IT', 'Administration', 'Sales'];
export const reportShifts = ['All Shifts', 'Morning', 'Night', 'Evening'];

// ---------------------------------------------------------------------------
// Employee program mock data
// ---------------------------------------------------------------------------

export const mockEmployees = [
  { id: 'EMP-1001', name: 'Rahim Ahmed', department: 'Production', designation: 'Line Operator', status: 'Active' },
  { id: 'EMP-1025', name: 'Karim Hasan', department: 'Finance', designation: 'Accountant', status: 'Active' },
  { id: 'EMP-1088', name: 'Hasan Ali', department: 'IT', designation: 'System Administrator', status: 'Active' },
  { id: 'EMP-1102', name: 'Fatima Begum', department: 'Human Resources', designation: 'HR Executive', status: 'Active' },
  { id: 'EMP-1112', name: 'Nasima Khatun', department: 'Sales', designation: 'Sales Officer', status: 'Active' },
  { id: 'EMP-1134', name: 'Abdul Karim', department: 'Production', designation: 'Supervisor', status: 'Active' },
  { id: 'EMP-1140', name: 'Nasir Uddin', department: 'Production', designation: 'Line Operator', status: 'Active' },
  { id: 'EMP-1156', name: 'Shirin Akter', department: 'Sales', designation: 'Sales Officer', status: 'Active' },
  { id: 'EMP-1178', name: 'Jamal Uddin', department: 'Quality Control', designation: 'QC Inspector', status: 'Active' },
  { id: 'EMP-1190', name: 'Sultana Razia', department: 'Production', designation: 'Line Operator', status: 'Probation' },
  { id: 'EMP-1201', name: 'Rina Sultana', department: 'Administration', designation: 'Admin Officer', status: 'Active' },
  { id: 'EMP-1203', name: 'Mizanur Rahman', department: 'Administration', designation: 'Office Assistant', status: 'Active' },
];

// ---------------------------------------------------------------------------
// Generic placeholder-program mock tables (Organization units, Shift, Holiday, etc.)
// ---------------------------------------------------------------------------

export const mockBranches = [
  { name: 'Head Office', code: 'HO', manager: 'Rina Sultana', status: 'Active' },
  { name: 'Chattogram Branch', code: 'CTG', manager: 'Abdul Karim', status: 'Active' },
  { name: 'Sylhet Branch', code: 'SYL', manager: '—', status: 'Active' },
];

export const mockLocations = [
  { name: 'Gazipur Factory', type: 'Factory', branch: 'Head Office', status: 'Active' },
  { name: 'Dhaka Corporate Office', type: 'Office', branch: 'Head Office', status: 'Active' },
  { name: 'Site Project A', type: 'Project', branch: 'Chattogram Branch', status: 'Active' },
];

export const mockDepartmentsTable = [
  { name: 'Production', code: 'PRD', branch: 'Head Office', employees: 420 },
  { name: 'Quality Control', code: 'QC', branch: 'Head Office', employees: 96 },
  { name: 'Human Resources', code: 'HR', branch: 'Head Office', employees: 32 },
  { name: 'Finance', code: 'FIN', branch: 'Head Office', employees: 44 },
  { name: 'IT', code: 'IT', branch: 'Head Office', employees: 38 },
];

export const mockSubDepartments = [
  { name: 'Sewing Line 1', department: 'Production', employees: 120 },
  { name: 'Sewing Line 2', department: 'Production', employees: 118 },
  { name: 'Cutting', department: 'Production', employees: 64 },
];

export const mockSections = [
  { name: 'Fabric QC', department: 'Quality Control', employees: 22 },
  { name: 'Final QC', department: 'Quality Control', employees: 30 },
];

export const mockDesignations = [
  { title: 'Line Operator', grade: 'Grade 5', department: 'Production', employees: 340 },
  { title: 'Supervisor', grade: 'Grade 3', department: 'Production', employees: 28 },
  { title: 'Accountant', grade: 'Grade 3', department: 'Finance', employees: 6 },
  { title: 'System Administrator', grade: 'Grade 2', department: 'IT', employees: 3 },
];

export const mockGrades = [
  { name: 'Grade 1', level: 1, minSalary: 120000, maxSalary: 200000 },
  { name: 'Grade 2', level: 2, minSalary: 70000, maxSalary: 120000 },
  { name: 'Grade 3', level: 3, minSalary: 40000, maxSalary: 70000 },
  { name: 'Grade 4', level: 4, minSalary: 25000, maxSalary: 40000 },
  { name: 'Grade 5', level: 5, minSalary: 14000, maxSalary: 25000 },
];

export const mockSuperiors = [
  { unit: 'Production', title: 'Head of Department', employee: 'Abdul Karim' },
  { unit: 'Quality Control', title: 'In-Charge', employee: 'Jamal Uddin' },
  { unit: 'Finance', title: 'Head of Department', employee: 'Karim Hasan' },
];

export const mockShifts = [
  { name: 'Morning', start: '08:00', end: '17:00', grace: 10, employees: 860 },
  { name: 'Evening', start: '14:00', end: '22:00', grace: 10, employees: 140 },
  { name: 'Night', start: '20:00', end: '05:00', grace: 15, employees: 210 },
];

export const mockHolidays = [
  { name: 'Independence Day', date: '2026-03-26', type: 'Government' },
  { name: 'Eid-ul-Fitr', date: '2026-04-11', type: 'Government' },
  { name: 'May Day', date: '2026-05-01', type: 'Government' },
  { name: 'Victory Day', date: '2026-12-16', type: 'Government' },
];

export const mockResignedEmployees = [
  { id: 'EMP-0891', name: 'Farid Uddin', department: 'Production', lastDay: '2026-07-15', reason: 'Resignation' },
  { id: 'EMP-0912', name: 'Salma Khatun', department: 'Sales', lastDay: '2026-06-30', reason: 'Contract End' },
  { id: 'EMP-0934', name: 'Tariq Islam', department: 'IT', lastDay: '2026-08-01', reason: 'Resignation' },
];

export const mockRosterAssignments = [
  { employee: 'Rahim Ahmed', department: 'Production', shift: 'Morning', from: '2026-08-17', to: '2026-08-23' },
  { employee: 'Nasir Uddin', department: 'Production', shift: 'Night', from: '2026-08-17', to: '2026-08-23' },
  { employee: 'Shirin Akter', department: 'Sales', shift: 'Morning', from: '2026-08-17', to: '2026-08-23' },
];

export const mockDailyAttendance = [
  { employee: 'Rahim Ahmed', employeeId: 'EMP-1001', department: 'Production', checkIn: '08:00', checkOut: '17:02', status: 'Present' },
  { employee: 'Karim Hasan', employeeId: 'EMP-1025', department: 'Finance', checkIn: '08:18', checkOut: '17:00', status: 'Late' },
  { employee: 'Jamal Uddin', employeeId: 'EMP-1178', department: 'Quality Control', checkIn: '—', checkOut: '—', status: 'Absent' },
];
