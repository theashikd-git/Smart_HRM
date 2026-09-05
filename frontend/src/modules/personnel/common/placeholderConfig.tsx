import { StatusBadge } from '@/components/shell/StatusBadge';
import { DataTableColumn } from '@/components/shell/DataTable';
import {
  mockBranches,
  mockLocations,
  mockDepartmentsTable,
  mockSubDepartments,
  mockSections,
  mockDesignations,
  mockGrades,
  mockSuperiors,
  mockShifts,
  mockHolidays,
  mockResignedEmployees,
  mockRosterAssignments,
} from '@/data/mock/personnel';
import type { PlaceholderConfig } from './PlaceholderProgram';

export const PLACEHOLDER_CONFIG: Record<string, PlaceholderConfig> = {
  'resigned-employees': {
    variant: 'table',
    rowKey: (r) => r.id,
    columns: [
      { key: 'id', header: 'Employee ID' },
      { key: 'name', header: 'Full Name' },
      { key: 'department', header: 'Department' },
      { key: 'lastDay', header: 'Last Working Day' },
      { key: 'reason', header: 'Reason' },
    ] satisfies DataTableColumn<(typeof mockResignedEmployees)[number]>[],
    rows: mockResignedEmployees,
  },

  'org-company': {
    variant: 'info',
    fields: [
      { label: 'Company Name', value: 'Smart HRM Industries Ltd.' },
      { label: 'Registration No.', value: 'BD-2014-778812' },
      { label: 'Head Office', value: 'Dhaka, Bangladesh' },
      { label: 'Industry', value: 'Manufacturing / Garments' },
      { label: 'Total Branches', value: '3' },
      { label: 'Total Employees', value: '1,248' },
    ],
  },

  'org-branch': {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Branch',
    columns: [
      { key: 'name', header: 'Branch' },
      { key: 'code', header: 'Code' },
      { key: 'manager', header: 'Manager' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ] satisfies DataTableColumn<(typeof mockBranches)[number]>[],
    rows: mockBranches,
  },

  'org-location': {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Location',
    columns: [
      { key: 'name', header: 'Location' },
      { key: 'type', header: 'Type' },
      { key: 'branch', header: 'Branch' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ] satisfies DataTableColumn<(typeof mockLocations)[number]>[],
    rows: mockLocations,
  },

  'org-department': {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Department',
    columns: [
      { key: 'name', header: 'Department' },
      { key: 'code', header: 'Code' },
      { key: 'branch', header: 'Branch' },
      { key: 'employees', header: 'Employees', align: 'right' },
    ] satisfies DataTableColumn<(typeof mockDepartmentsTable)[number]>[],
    rows: mockDepartmentsTable,
  },

  'org-subdepartment': {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Sub-department',
    columns: [
      { key: 'name', header: 'Sub-department' },
      { key: 'department', header: 'Department' },
      { key: 'employees', header: 'Employees', align: 'right' },
    ] satisfies DataTableColumn<(typeof mockSubDepartments)[number]>[],
    rows: mockSubDepartments,
  },

  'org-section': {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Section',
    columns: [
      { key: 'name', header: 'Section' },
      { key: 'department', header: 'Department' },
      { key: 'employees', header: 'Employees', align: 'right' },
    ] satisfies DataTableColumn<(typeof mockSections)[number]>[],
    rows: mockSections,
  },

  'org-designation': {
    variant: 'table',
    rowKey: (r) => r.title,
    addLabel: 'Add Designation',
    columns: [
      { key: 'title', header: 'Designation' },
      { key: 'grade', header: 'Grade' },
      { key: 'department', header: 'Department' },
      { key: 'employees', header: 'Employees', align: 'right' },
    ] satisfies DataTableColumn<(typeof mockDesignations)[number]>[],
    rows: mockDesignations,
  },

  'org-grade': {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Grade',
    columns: [
      { key: 'name', header: 'Grade' },
      { key: 'level', header: 'Level', align: 'right' },
      { key: 'minSalary', header: 'Min Salary', align: 'right', render: (r) => r.minSalary.toLocaleString() },
      { key: 'maxSalary', header: 'Max Salary', align: 'right', render: (r) => r.maxSalary.toLocaleString() },
    ] satisfies DataTableColumn<(typeof mockGrades)[number]>[],
    rows: mockGrades,
  },

  'superior-management': {
    variant: 'table',
    rowKey: (r) => `${r.unit}-${r.title}`,
    addLabel: 'Assign Superior',
    columns: [
      { key: 'unit', header: 'Unit' },
      { key: 'title', header: 'Title' },
      { key: 'employee', header: 'Employee' },
    ] satisfies DataTableColumn<(typeof mockSuperiors)[number]>[],
    rows: mockSuperiors,
  },

  roster: {
    variant: 'table',
    rowKey: (r) => `${r.employee}-${r.from}`,
    addLabel: 'Create Roster',
    columns: [
      { key: 'employee', header: 'Employee' },
      { key: 'department', header: 'Department' },
      { key: 'shift', header: 'Shift' },
      { key: 'from', header: 'From' },
      { key: 'to', header: 'To' },
    ] satisfies DataTableColumn<(typeof mockRosterAssignments)[number]>[],
    rows: mockRosterAssignments,
  },

  shift: {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Shift',
    columns: [
      { key: 'name', header: 'Shift' },
      { key: 'start', header: 'Start' },
      { key: 'end', header: 'End' },
      { key: 'grace', header: 'Grace (min)', align: 'right' },
      { key: 'employees', header: 'Employees', align: 'right' },
    ] satisfies DataTableColumn<(typeof mockShifts)[number]>[],
    rows: mockShifts,
  },

  holiday: {
    variant: 'table',
    rowKey: (r) => r.name,
    addLabel: 'Add Holiday',
    columns: [
      { key: 'name', header: 'Holiday' },
      { key: 'date', header: 'Date' },
      { key: 'type', header: 'Type' },
    ] satisfies DataTableColumn<(typeof mockHolidays)[number]>[],
    rows: mockHolidays,
  },
};
