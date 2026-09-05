import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyLabel?: string;
  dense?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  rowKey,
  emptyLabel = 'No records found',
  dense,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded border border-line">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-surface-sunken/70 border-b border-line">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-muted whitespace-nowrap',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="table-row-hover hover:bg-surface-sunken/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-3 text-text-primary align-middle whitespace-nowrap',
                    dense ? 'py-1.5' : 'py-2.5',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-text-muted">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
