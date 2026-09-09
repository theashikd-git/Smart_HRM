'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useUpdateDepartment } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';
import type { Department } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  department: Department | null;
}

interface NewRow {
  key: string;
  name: string;
}

interface ExistingRow {
  id: string;
  name: string;
  removed: boolean;
}

/**
 * Edit Department popup: rename the department, change its manager, add
 * new sub-departments, and remove existing ones -- all saved together in
 * one Confirm click (DepartmentsService.update() applies it as a single
 * transaction).
 */
export function EditDepartmentModal({ open, onClose, department }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [existingRows, setExistingRows] = useState<ExistingRow[]>([]);
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [errors, setErrors] = useState<{ name?: string; code?: string; general?: string; rows?: Record<string, string> }>({});
  const rowKeyRef = useRef(0);

  const { data: employees } = useEmployees({ pageSize: 500 });
  const updateDepartment = useUpdateDepartment();

  // Re-seed the form every time a different department is opened for
  // editing (or the popup is reopened on the same one after a refetch).
  useEffect(() => {
    if (!open || !department) return;
    setCode(department.code);
    setName(department.name);
    setManagerId(department.headEmployeeId || '');
    setExistingRows((department.subDepartments ?? []).map((s) => ({ id: s.id, name: s.name, removed: false })));
    setNewRows([]);
    setErrors({});
  }, [open, department]);

  function handleClose() {
    onClose();
  }

  function addRow() {
    rowKeyRef.current += 1;
    setNewRows((prev) => [...prev, { key: `row-${rowKeyRef.current}`, name: '' }]);
  }

  function updateNewRow(key: string, value: string) {
    setNewRows((prev) => prev.map((r) => (r.key === key ? { ...r, name: value } : r)));
  }

  function removeNewRow(key: string) {
    setNewRows((prev) => prev.filter((r) => r.key !== key));
    setErrors((prev) => {
      if (!prev.rows?.[key]) return prev;
      const rest = { ...prev.rows };
      delete rest[key];
      return { ...prev, rows: rest };
    });
  }

  function removeExistingRow(id: string) {
    setExistingRows((prev) => prev.map((r) => (r.id === id ? { ...r, removed: true } : r)));
  }

  function restoreExistingRow(id: string) {
    setExistingRows((prev) => prev.map((r) => (r.id === id ? { ...r, removed: false } : r)));
  }

  async function handleConfirm() {
    if (!department) return;
    const nextErrors: typeof errors = { rows: {} };

    if (!name.trim()) nextErrors.name = 'Department name is required';
    if (!code.trim()) nextErrors.code = 'Department code is required';

    const seen = new Map<string, string>(); // lowercased name -> first row key ('existing:<id>' or the new-row key)
    for (const row of existingRows) {
      if (row.removed) continue;
      seen.set(row.name.trim().toLowerCase(), `existing:${row.id}`);
    }
    for (const row of newRows) {
      if (!row.name.trim()) {
        nextErrors.rows![row.key] = 'Sub-department name is required';
        continue;
      }
      const key = row.name.trim().toLowerCase();
      if (seen.has(key)) {
        nextErrors.rows![row.key] = 'Duplicate name -- already used by another sub-department here';
      } else {
        seen.set(key, row.key);
      }
    }

    const hasErrors = !!nextErrors.name || !!nextErrors.code || Object.keys(nextErrors.rows!).length > 0;
    if (hasErrors) {
      setErrors(nextErrors);
      return; // leave the popup open so the user can fix the flagged field(s)
    }
    setErrors({});

    try {
      await updateDepartment.mutateAsync({
        id: department.id,
        name: name.trim(),
        code: code.trim(),
        headEmployeeId: managerId || undefined,
        subDepartments: newRows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim() })),
        removeSubDepartmentIds: existingRows.filter((r) => r.removed).map((r) => r.id),
      });
      toast.success(`Department "${name.trim()}" updated`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  if (!department) return null;

  const visibleExisting = existingRows.filter((r) => !r.removed);
  const removedExisting = existingRows.filter((r) => r.removed);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit Department"
      subtitle={department.name}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={updateDepartment.isPending}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {errors.general && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {errors.general}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrap label="Department Code" required error={errors.code}>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </FieldWrap>
          <FieldWrap label="Department Name" required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Department Manager" hint="Optional">
            <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">No manager</option>
              {employees?.items.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>

        <div>
          <div className="flex items-center justify-between border-t border-line pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Sub-Departments</p>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" /> Add Sub-Dept
            </Button>
          </div>

          {visibleExisting.length > 0 && (
            <div className="mt-3 space-y-2">
              {visibleExisting.map((row) => (
                <div key={row.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken/40 px-3 py-2">
                  <span className="flex-1 text-sm text-text-primary">{row.name}</span>
                  <button
                    type="button"
                    onClick={() => removeExistingRow(row.id)}
                    title="Remove sub-department"
                    className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {removedExisting.length > 0 && (
            <div className="mt-2 space-y-1">
              {removedExisting.map((row) => (
                <div key={row.id} className="flex items-center gap-2 px-3 py-1 text-xs text-text-muted">
                  <span className="flex-1 line-through">{row.name} -- will be removed</span>
                  <button type="button" onClick={() => restoreExistingRow(row.id)} className="text-accent hover:underline">
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}

          {newRows.length > 0 && (
            <div className="mt-3 space-y-3">
              {newRows.map((row) => (
                <div key={row.key} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      value={row.name}
                      onChange={(e) => updateNewRow(row.key, e.target.value)}
                      placeholder="New sub-department name"
                    />
                    {errors.rows?.[row.key] && <p className="mt-1 text-xs text-danger">{errors.rows[row.key]}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNewRow(row.key)}
                    title="Remove row"
                    className="mt-0.5 shrink-0 rounded-md p-2 text-text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {visibleExisting.length === 0 && newRows.length === 0 && (
            <p className="mt-3 text-xs text-text-muted italic">
              No sub-departments yet. Add one if this department has divisions (e.g. X-Ray, USG, MRI under Radiology).
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
