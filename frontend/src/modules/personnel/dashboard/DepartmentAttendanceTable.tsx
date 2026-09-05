import { DataTable, DataTableColumn } from '@/components/shell/DataTable';
import { useDepartmentAttendanceChart } from '@/hooks/useDashboard';

interface Row {
  department: string;
  employees: number;
  present: number;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'department', header: 'Department' },
  { key: 'employees', header: 'Total', align: 'right' },
  { key: 'present', header: 'Present Today', align: 'right', render: (r) => <span className="text-success font-medium">{r.present}</span> },
  {
    key: 'pct',
    header: 'Present %',
    align: 'right',
    render: (r) => (r.employees > 0 ? `${Math.round((r.present / r.employees) * 100)}%` : '—'),
  },
];

export function DepartmentAttendanceTable() {
  const { data, isLoading } = useDepartmentAttendanceChart();

  return (
    <div className="rounded border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-text-primary">Department Attendance</h3>
      </div>
      <div className="p-3.5">
        <DataTable
          columns={columns}
          rows={data || []}
          rowKey={(r) => r.department}
          dense
          emptyLabel={isLoading ? 'Loading...' : 'No department data yet'}
        />
      </div>
    </div>
  );
}
