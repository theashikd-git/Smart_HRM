'use client';

import { Plus } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { DataTable, DataTableColumn } from '@/components/shell/DataTable';
import type { WorkbenchTab } from '@/types/workbench';

interface PlaceholderTableConfig<T extends Record<string, any>> {
  variant: 'table';
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  addLabel?: string;
}

interface PlaceholderInfoConfig {
  variant: 'info';
  fields: { label: string; value: string }[];
}

export type PlaceholderConfig<T extends Record<string, any> = any> = PlaceholderTableConfig<T> | PlaceholderInfoConfig;

export function PlaceholderProgram({ tab, config }: { tab: WorkbenchTab; config: PlaceholderConfig }) {
  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        config.variant === 'table' && config.addLabel ? (
          <button className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark">
            <Plus className="h-3.5 w-3.5" /> {config.addLabel}
          </button>
        ) : undefined
      }
    >
      {config.variant === 'table' ? (
        <DataTable columns={config.columns} rows={config.rows} rowKey={config.rowKey} />
      ) : (
        <div className="max-w-xl rounded border border-line bg-white p-5">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {config.fields.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{f.label}</dt>
                <dd className="mt-0.5 text-xs text-text-primary">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </ProgramWorkspace>
  );
}
