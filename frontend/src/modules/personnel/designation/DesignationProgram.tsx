'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, IdCard, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import { useDesignations, useDeleteDesignation } from '@/hooks/useDesignations';
import { apiErrorMessage } from '@/lib/api';
import { AddDesignationModal } from './AddDesignationModal';
import { EditDesignationModal } from './EditDesignationModal';
import type { Designation } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const UNASSIGNED_KEY = '__unassigned';

interface DeptGroup {
  key: string;
  name: string;
  items: Designation[];
}

/** Designation list, grouped by department (structure-wise), with a dense
 *  compact layout so many rows fit on screen at once. */
export function DesignationProgram({ tab }: { tab: WorkbenchTab }) {
  const { data: designations, isLoading } = useDesignations();
  const deleteDesignation = useDeleteDesignation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo<DeptGroup[]>(() => {
    if (!designations) return [];
    const byDept = new Map<string, DeptGroup>();
    for (const d of designations) {
      const key = d.department?.id ?? UNASSIGNED_KEY;
      const name = d.department?.name ?? 'Unassigned';
      if (!byDept.has(key)) byDept.set(key, { key, name, items: [] });
      byDept.get(key)!.items.push(d);
    }
    const arr = Array.from(byDept.values());
    arr.sort((a, b) => {
      if (a.key === UNASSIGNED_KEY) return 1;
      if (b.key === UNASSIGNED_KEY) return -1;
      return a.name.localeCompare(b.name);
    });
    for (const g of arr) g.items.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [designations]);

  function toggle(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  async function handleDelete(designation: Designation) {
    if (!confirm(`Permanently delete "${designation.title}"?`)) return;
    try {
      await deleteDesignation.mutateAsync(designation.id);
      toast.success('Designation deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Designation
        </Button>
      }
    >
      <Card className="overflow-hidden">
        {!isLoading && groups.length === 0 && (
          <EmptyState
            icon={<IdCard className="h-8 w-8" />}
            title="No designations yet"
            subtitle="Add your first designation to get started."
          />
        )}

        {groups.map((g) => {
          const isCollapsed = !!collapsed[g.key];
          return (
            <div key={g.key} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                className="flex w-full items-center justify-between gap-2 bg-surface-sunken/60 px-4 py-2 text-left hover:bg-surface-sunken"
              >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                  )}
                  <Building2 className="h-3.5 w-3.5 text-text-muted" />
                  {g.name}
                </span>
                <Badge>{g.items.length}</Badge>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-line/60">
                  {g.items.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 py-1.5 pl-9 pr-4 text-xs hover:bg-surface-sunken/40"
                    >
                      <IdCard className="h-3 w-3 shrink-0 text-text-muted" />
                      <span className="flex-1 truncate font-medium text-text-primary">{d.title}</span>
                      <Badge className={d.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>
                        {d.status}
                      </Badge>
                      <span className="w-16 shrink-0 text-right text-text-muted">
                        {d._count?.employees ?? 0} emp
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          onClick={() => setEditing(d)}
                          title="Edit designation"
                          className="rounded p-1 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          title="Delete designation"
                          className="rounded p-1 text-text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <AddDesignationModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <EditDesignationModal open={!!editing} onClose={() => setEditing(null)} designation={editing} />
    </ProgramWorkspace>
  );
}
