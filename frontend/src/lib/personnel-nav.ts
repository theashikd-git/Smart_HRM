import {
  LayoutDashboard,
  Users,
  UserX,
  Building2,
  GitBranch,
  MapPin,
  Network,
  LayoutGrid,
  IdCard,
  Layers,
  CalendarClock,
  CalendarDays,
  Clock,
  CalendarOff,
  CalendarCheck,
  FileBarChart,
} from 'lucide-react';
import type { ProgramDefinition, SidebarNode } from '@/types/workbench';

/** Every program that can be opened from the Personnel sidebar, keyed by id. */
export const PROGRAM_REGISTRY: Record<string, ProgramDefinition> = {
  employee: {
    id: 'employee',
    title: 'Employee',
    breadcrumb: ['Personnel', 'Employee'],
    internalTabs: [
      { id: 'list', label: 'Employee List' },
      { id: 'profile', label: 'Profile' },
      { id: 'documents', label: 'Documents' },
      { id: 'history', label: 'History' },
    ],
    defaultInternalTab: 'list',
  },
  'resigned-employees': {
    id: 'resigned-employees',
    title: 'Resigned Employees',
    breadcrumb: ['Personnel', 'Resigned Employees'],
  },
  'org-company': { id: 'org-company', title: 'Company', breadcrumb: ['Personnel', 'Organization', 'Company'] },
  'org-branch': { id: 'org-branch', title: 'Branch', breadcrumb: ['Personnel', 'Organization', 'Branch'] },
  'org-location': { id: 'org-location', title: 'Location', breadcrumb: ['Personnel', 'Organization', 'Location'] },
  'org-department': {
    id: 'org-department',
    title: 'Department',
    breadcrumb: ['Personnel', 'Organization', 'Department'],
  },
  'org-subdepartment': {
    id: 'org-subdepartment',
    title: 'Sub-department',
    breadcrumb: ['Personnel', 'Organization', 'Sub-department'],
  },
  'org-section': { id: 'org-section', title: 'Section', breadcrumb: ['Personnel', 'Organization', 'Section'] },
  'org-designation': {
    id: 'org-designation',
    title: 'Designation',
    breadcrumb: ['Personnel', 'Organization', 'Designation'],
  },
  'org-grade': { id: 'org-grade', title: 'Grade', breadcrumb: ['Personnel', 'Organization', 'Grade'] },
  'superior-management': {
    id: 'superior-management',
    title: 'Superior Management',
    breadcrumb: ['Personnel', 'Leave Management', 'Superior Management'],
  },
  'leave-workflows': {
    id: 'leave-workflows',
    title: 'Leave Workflows',
    breadcrumb: ['Personnel', 'Leave Management', 'Leave Workflows'],
  },
  'leave-type': {
    id: 'leave-type',
    title: 'Leave Type',
    breadcrumb: ['Personnel', 'Leave Management', 'Leave Type'],
  },
  roster: { id: 'roster', title: 'Roster', breadcrumb: ['Personnel', 'Roster'] },
  shift: { id: 'shift', title: 'Shift', breadcrumb: ['Personnel', 'Shift'] },
  holiday: { id: 'holiday', title: 'Government Holiday', breadcrumb: ['Personnel', 'Government Holiday'] },
  attendance: {
    id: 'attendance',
    title: 'Attendance',
    breadcrumb: ['Personnel', 'Attendance'],
    internalTabs: [
      { id: 'daily', label: 'Daily Attendance' },
      { id: 'monthly', label: 'Monthly Attendance' },
      { id: 'late', label: 'Late' },
      { id: 'absent', label: 'Absent' },
      { id: 'overtime', label: 'Overtime' },
    ],
    defaultInternalTab: 'daily',
  },
  reports: {
    id: 'reports',
    title: 'Reports',
    breadcrumb: ['Personnel', 'Reports'],
    internalTabs: [
      { id: 'late', label: 'Late Report' },
      { id: 'absent', label: 'Absent Report' },
      { id: 'overtime', label: 'Overtime Report' },
      { id: 'present', label: 'Present Report' },
      { id: 'early-out', label: 'Early Out Report' },
      { id: 'missing-punch', label: 'Missing Punch Report' },
    ],
    defaultInternalTab: 'late',
  },
};

/** The Personnel sidebar tree. Levels 1-2 of the navigation architecture. */
export const PERSONNEL_SIDEBAR: SidebarNode[] = [
  { type: 'leaf', id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, programId: 'dashboard', isDashboard: true },
  { type: 'leaf', id: 'employee', label: 'Employee', icon: Users, programId: 'employee' },
  { type: 'leaf', id: 'resigned-employees', label: 'Resigned Employees', icon: UserX, programId: 'resigned-employees' },
  {
    type: 'group',
    id: 'organization',
    label: 'Organization',
    icon: Building2,
    children: [
      { type: 'leaf', id: 'org-company', label: 'Company', programId: 'org-company' },
      { type: 'leaf', id: 'org-branch', label: 'Branch', programId: 'org-branch' },
      { type: 'leaf', id: 'org-location', label: 'Location', programId: 'org-location' },
      { type: 'leaf', id: 'org-department', label: 'Department', programId: 'org-department' },
      { type: 'leaf', id: 'org-subdepartment', label: 'Sub-department', programId: 'org-subdepartment' },
      { type: 'leaf', id: 'org-section', label: 'Section', programId: 'org-section' },
      { type: 'leaf', id: 'org-designation', label: 'Designation', programId: 'org-designation' },
      { type: 'leaf', id: 'org-grade', label: 'Grade', programId: 'org-grade' },
    ],
  },
  {
    type: 'group',
    id: 'leave-management',
    label: 'Leave Management',
    icon: CalendarClock,
    children: [
      { type: 'leaf', id: 'superior-management', label: 'Superior Management', programId: 'superior-management' },
      { type: 'leaf', id: 'leave-workflows', label: 'Leave Workflows', programId: 'leave-workflows' },
      { type: 'leaf', id: 'leave-type', label: 'Leave Type', programId: 'leave-type' },
    ],
  },
  { type: 'leaf', id: 'roster', label: 'Roster', icon: CalendarDays, programId: 'roster' },
  { type: 'leaf', id: 'shift', label: 'Shift', icon: Clock, programId: 'shift' },
  { type: 'leaf', id: 'holiday', label: 'Government Holiday', icon: CalendarOff, programId: 'holiday' },
  { type: 'leaf', id: 'attendance', label: 'Attendance', icon: CalendarCheck, programId: 'attendance' },
  {
    type: 'group',
    id: 'reports',
    label: 'Reports',
    icon: FileBarChart,
    children: [
      { type: 'leaf', id: 'late-report', label: 'Late Report', programId: 'reports', internalTabId: 'late' },
      { type: 'leaf', id: 'absent-report', label: 'Absent Report', programId: 'reports', internalTabId: 'absent' },
      { type: 'leaf', id: 'overtime-report', label: 'Overtime Report', programId: 'reports', internalTabId: 'overtime' },
      { type: 'leaf', id: 'present-report', label: 'Present Report', programId: 'reports', internalTabId: 'present' },
      { type: 'leaf', id: 'early-out-report', label: 'Early Out Report', programId: 'reports', internalTabId: 'early-out' },
      { type: 'leaf', id: 'missing-punch-report', label: 'Missing Punch Report', programId: 'reports', internalTabId: 'missing-punch' },
    ],
  },
];

// Icons used elsewhere (org sub-items, kept here so the registry file is the single source of nav metadata).
export const ORG_ICONS: Record<string, typeof Building2> = {
  'org-company': Building2,
  'org-branch': GitBranch,
  'org-location': MapPin,
  'org-department': Building2,
  'org-subdepartment': Network,
  'org-section': LayoutGrid,
  'org-designation': IdCard,
  'org-grade': Layers,
};
