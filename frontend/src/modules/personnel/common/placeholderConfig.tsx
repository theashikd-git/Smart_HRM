import { StatusBadge } from '@/components/shell/StatusBadge';
import { DataTableColumn } from '@/components/shell/DataTable';
import {
  mockSuperiors,
  mockShifts,
  mockHolidays,
  mockResignedEmployees,
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
