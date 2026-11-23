'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Pencil, IdCard, Search } from 'lucide-react';
import { Card, Badge } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Table';
import { useDesignations, useDeleteDesignation } from '@/hooks/useDesignations';
import { apiErrorMessage } from '@/lib/api';
import { AddDesignationModal } from './AddDesignationModal';
import { EditDesignationModal } from './EditDesignationModal';
import type { Designation } from '@/types';

interface Props {
  addOpen: boolean;
  onAddClose: () => void;
}

/** One flat, company-wide designation list: name, status, employee count and
 *  the departments each designation is linked to. */
export function DesignationList({ addOpen, onAddClose }: Props) {
  const { data: designations, isLoading } = useDesignations();
  const deleteDesignation = useDeleteDesignation();
  const [editing, setEditing] = useState<Designation | null>(null);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = [...(designations ?? [])].sort((a, b) => a.title.localeCompare(b.title));
    if (!q) return all;
    return all.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.departments ?? []).some((dep) => dep.name.toLowerCase().includes(q)),
    );
  }, [designations, search]);

  async function handleDelete(designation: Designation) {
    if (!confirm(`Permanently delete "${designation.title}"?`)) return;
    try {
      await deleteDesignation.mutateAsync(designation.id);
      toast.success('Designation deleted');
    } catch (err) {
      // e.g. "X is held by 3 employee(s), so it can't be deleted. Set it to Inactive instead."
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search designation or department"
              className="pl-8"
            />
          </div>
          <p className="shrink-0 text-xs text-text-muted">
            {rows.length} of {designations?.length ?? 0} designations
          </p>
        </div>

        {!isLoading && rows.length === 0 && (
          <EmptyState
            icon={<IdCard className="h-8 w-8" />}
            title={designations?.length ? 'No matching designations' : 'No designations yet'}
            subtitle={
              designations?.length
                ? 'Try a different search.'
                : 'Add your first designation to get started.'
            }
          />
        )}

        <div className="divide-y divide-line/60">
          {rows.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-surface-sunken/40">
              <IdCard className="h-3 w-3 shrink-0 text-text-muted" />
              <span className="w-56 shrink-0 truncate font-medium text-text-primary">{d.title}</span>
              <Badge className={d.status === 'ACTIVE' ? 'text-success bg-success-soft' : ''}>{d.status}</Badge>
              <span className="w-16 shrink-0 text-right text-text-muted">{d._count?.employees ?? 0} emp</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                {(d.departments ?? []).length === 0 ? (
                  <span className="text-text-muted">Not linked to any department</span>
                ) : (
                  d.departments!.map((dep) => (
                    <span
                      key={dep.id}
                      className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-secondary"
                    >
                      {dep.name}
                    </span>
                  ))
                )}
              </div>
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
      </Card>

      <AddDesignationModal open={addOpen} onClose={onAddClose} />
      <EditDesignationModal open={!!editing} onClose={() => setEditing(null)} designation={editing} />
    </>
  );
}
