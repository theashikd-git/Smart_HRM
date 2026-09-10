'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchSelectOption {
  id: string;
  label: string;
  /** Shown dimmed under the label, and searched along with it -- e.g. an
   *  employee ID, so typing an ID finds the right person as fast as a name. */
  sublabel?: string;
}

interface SearchSelectProps {
  value: string;
  onChange: (id: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

/**
 * A type-to-search dropdown, standard "combobox" pattern: closed state shows
 * the current pick (label + sublabel), clicking opens a search box that
 * filters the option list live by label OR sublabel as you type. Used for
 * picking a specific person (searchable by name or employee ID) instead of
 * scrolling a long native <select>.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search by name or ID…',
  emptyText = 'No matches',
  disabled,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-2 text-left text-xs',
          'focus:outline-none focus:ring-2 focus:ring-accent/40',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {selected ? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-text-primary">{selected.label}</span>
            {selected.sublabel && <span className="truncate text-[11px] text-text-muted">{selected.sublabel}</span>}
          </span>
        ) : (
          <span className="truncate text-text-muted">{placeholder}</span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded p-0.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              title="Clear"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-line bg-white shadow-popover">
          <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-4 text-center text-xs text-text-muted">{emptyText}</p>}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-surface-sunken',
                  o.id === value && 'bg-accent-soft/60',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-text-primary">{o.label}</span>
                  {o.sublabel && <span className="block truncate text-[11px] text-text-muted">{o.sublabel}</span>}
                </span>
                {o.id === value && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
