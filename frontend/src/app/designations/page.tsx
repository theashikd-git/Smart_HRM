'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, IdCard, Pencil, Trash2, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Card';
import {
  useDesignations,
  useCreateDesignation,
  useUpdateDesignation,
  useDeleteDesignation,
} from '@/hooks/useDesignations';
import { useDepartments } from '@/hooks/useDepartments';
import { apiErrorMessage } from '@/lib/api';
import { Designation } from '@/types';

const EMPTY_FORM = { title: '', departmentId: '', status: 'ACTIVE' };
const UNASSIGNED_KEY = '__unassigned';

interface DeptGroup {
  key: string;
  name: string;
  items: Designation[];
}

export default function DesignationsPage() {
  const { data, isLoading } = useDesignations();
  const { data: departments } = useDepartments();
  const createDesig = useCreateDesignation();
  const updateDesig = useUpdateDesignation();
  const deleteDesig = useDeleteDesignation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo<DeptGroup[]>(() => {
    if (!data) return [];
    const byDept = new Map<string, DeptGroup>();
    for (const d of data) {
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
  }, [data]);

  function toggle(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(d: Designation) {
    setEditing(d);
    setForm({
      title: d.title,
      departmentId: d.departmentId ?? '',
      status: d.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      departmentId: form.departmentId || undefined,
      status: form.status,
    };
    try {
      if (editing) {
        await updateDesig.mutateAsync({ id: editing.id, ...payload });
        toast.success('Designation updated');
      } else {
        await createDesig.mutateAsync(payload);
        toast.success('Designation created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete(d: Designation) {
    if (!confirm(`Delete designation "${d.title}"?`)) return;
    try {
      await deleteDesig.mutateAsync(d.id);
      toast.success('Designation deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Designations" subtitle="Job titles used across the organization">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <p className="text-sm text-text-secondary">{data?.length || 0} designations</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Designation
          </Button>
        </div>

        {!isLoading && groups.length === 0 && (
          <EmptyState icon={<IdCard className="h-8 w-8" />} title="No designations yet" />
        )}

        {groups.map((g) => {
          const isCollapsed = !!collapsed[g.key];
          return (
            <div key={g.key} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                className="flex w-full items-center justify-between gap-2 bg-surface-sunken/60 px-5 py-2 text-left hover:bg-surface-sunken"
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
                      className="flex items-center gap-3 py-1.5 pl-10 pr-5 text-xs hover:bg-surface-sunken/40"
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
                          onClick={() => openEdit(d)}
                          className="rounded p-1 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Designation' : 'Add Designation'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="desig-form" loading={createDesig.isPending || updateDesig.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="desig-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldWrap label="Title" required>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} required autoFocus />
            </FieldWrap>
          </div>
          <FieldWrap label="Department">
            <Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">Unassigned</option>
              {departments?.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <FieldWrap label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FieldWrap>
        </form>
      </Modal>
    </AppShell>
  );
}
