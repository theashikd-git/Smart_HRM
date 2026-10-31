'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { useAuthStore } from '@/lib/auth-store';
import { PERSONNEL_SIDEBAR, PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import type { ModuleId, SidebarLeaf } from '@/types/workbench';

interface SearchEntry {
  key: string;
  label: string;
  groupLabel: string;
  icon?: LucideIcon;
  locked?: boolean;
  isDashboard?: boolean;
  programId?: string;
  internalTabId?: string;
  moduleId?: ModuleId;
}

function leafToEntry(leaf: SidebarLeaf, groupLabel: string, fallbackIcon?: LucideIcon): SearchEntry {
  return {
    key: leaf.id,
    label: leaf.label,
    groupLabel,
    icon: leaf.icon ?? fallbackIcon,
    locked: leaf.locked,
    isDashboard: leaf.isDashboard,
    programId: leaf.programId,
    internalTabId: leaf.internalTabId,
  };
}

/** Every leaf in the Personnel sidebar, flattened into one searchable list
 *  (group headers become each entry's subtitle) -- this is the single
 *  source of nav metadata (see personnel-nav.ts), so a new sidebar entry
 *  is automatically searchable without touching this file. */
function flattenPersonnelSidebar(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const node of PERSONNEL_SIDEBAR) {
    if (node.type === 'leaf') {
      out.push(leafToEntry(node, 'Personnel'));
    } else {
      for (const child of node.children) {
        out.push(leafToEntry(child, node.label, node.icon));
      }
    }
  }
  return out;
}

/**
 * Search-everything popup for the top-right header -- replaces the old
 * non-functional "Program launcher" grid icon. Searches every Personnel
 * sidebar program (and internal-tab shortcut, e.g. "Late Report") plus the
 * other top-level modules the signed-in role can reach (Leave, and System
 * Settings for ADMIN) -- i.e. exactly what's actually open to this user,
 * mirroring TopNavigation's own MODULES role filter. The disabled Payroll
 * module and the unreachable Device module (see AppShellRoot) are left out.
 */
export function ProgramSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const user = useAuthStore((s) => s.user);
  const setActiveModule = useWorkbenchStore((s) => s.setActiveModule);
  const activateTab = useWorkbenchStore((s) => s.activateTab);
  const openProgram = useWorkbenchStore((s) => s.openProgram);

  const allEntries = useMemo<SearchEntry[]>(() => {
    const moduleEntries: SearchEntry[] = [{ key: 'module-leave', label: 'Leave', groupLabel: 'Module', moduleId: 'leave' }];
    if (user?.role === 'ADMIN') {
      moduleEntries.push({ key: 'module-system-settings', label: 'System Settings', groupLabel: 'Module', moduleId: 'system-settings' });
    }
    return [...flattenPersonnelSidebar(), ...moduleEntries];
  }, [user?.role]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter(
      (e) => e.label.toLowerCase().includes(q) || e.groupLabel.toLowerCase().includes(q),
    );
  }, [allEntries, query]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleToggle() {
    setOpen((v) => !v);
    setQuery('');
  }

  function handleSelect(entry: SearchEntry) {
    if (entry.locked) return;
    if (entry.moduleId) {
      setActiveModule(entry.moduleId);
    } else if (entry.isDashboard) {
      setActiveModule('personnel');
      activateTab('workbench');
    } else if (entry.programId) {
      const program = PROGRAM_REGISTRY[entry.programId];
      if (!program) return;
      setActiveModule('personnel');
      openProgram(program, { title: entry.label, internalTab: entry.internalTabId });
    }
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Search everything"
        className="flex h-7 w-7 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-md border border-line bg-white shadow-popover text-text-primary">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees, leave, attendance, holidays..."
              className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {results.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-text-muted">No matching module or program.</div>
            )}
            {results.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => handleSelect(entry)}
                  disabled={entry.locked}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs',
                    entry.locked ? 'cursor-not-allowed text-text-muted/60' : 'text-text-primary hover:bg-surface-sunken',
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" /> : <span className="h-3.5 w-3.5 shrink-0" />}
                  <span className="flex-1 truncate">{entry.label}</span>
                  {entry.locked ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                      <Lock className="h-2.5 w-2.5" />
                      Soon
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-text-muted">{entry.groupLabel}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
