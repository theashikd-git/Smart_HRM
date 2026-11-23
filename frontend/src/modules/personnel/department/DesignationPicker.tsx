'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Form';
import { useDesignations } from '@/hooks/useDesignations';

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Searchable multi-select over the shared designation list, with select all / clear.
 *  "Select all" and the search act on the rows currently shown. */
export function DesignationPicker({ value, onChange }: Props) {
  const { data: designations, isLoading } = useDesignations();
  const [search, setSearch] = useState('');
  const selected = useMemo(() => new Set(value), [value]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = [...(designations ?? [])].sort((a, b) => a.title.localeCompare(b.title));
    return q ? all.filter((d) => d.title.toLowerCase().includes(q)) : all;
  }, [designations, search]);

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function selectAllShown() {
    const next = new Set(value);
    for (const d of shown) next.add(d.id);
    onChange(Array.from(next));
  }

  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designations"
            className="pl-8"
          />
        </div>
        <button type="button" onClick={selectAllShown} className="text-xs font-medium text-accent-dark hover:underline">
          Select all
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={value.length === 0}
          className="text-xs font-medium text-text-secondary hover:underline disabled:opacity-40 disabled:no-underline"
        >
          Clear
        </button>
      </div>

      <div className="max-h-52 overflow-y-auto py-1">
        {isLoading && <p className="px-3 py-2 text-xs text-text-muted">Loading...</p>}
        {!isLoading && shown.length === 0 && (
          <p className="px-3 py-2 text-xs text-text-muted">
            {designations?.length ? 'No matching designations.' : 'No designations yet. Add them under Organization > Designation.'}
          </p>
        )}
        {shown.map((d) => (
          <label
            key={d.id}
            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-sunken/60"
          >
            <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
            <span className="flex-1 truncate text-text-primary">{d.title}</span>
            {d.status !== 'ACTIVE' && <span className="text-[11px] text-text-muted">Inactive</span>}
          </label>
        ))}
      </div>

      <div className="border-t border-line px-3 py-1.5 text-[11px] text-text-muted">
        {value.length} selected
      </div>
    </div>
  );
}
