'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select } from '@/components/ui/Form';
import { useCreateDepartment } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface SubRow {
  key: string;
  name: string;
}

function codeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12);
}

/**
 * "Add Department" popup: parent department fields up top, then a
 * Sub-Departments section where the user can add as many rows as needed
 * (e.g. "X-Ray", then "USG", then "MRI" -- all under one new "Radiology"
 * department) before saving everything together in one transaction.
 */
export function AddDepartmentModal({ open, onClose }: Props) {
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [rows, setRows] = useState<SubRow[]>([]);
  const [errors, setErrors] = useState<{ name?: string; code?: string; general?: string; rows?: Record<string, string> }>({});
  const rowKeyRef = useRef(0);

  const { data: employees } = useEmployees({ pageSize: 500 });
  const createDepartment = useCreateDepartment();

  function reset() {
    setCode('');
    setCodeTouched(false);
    setName('');
    setManagerId('');
    setRows([]);
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!codeTouched) setCode(codeFromName(value));
  }

  function handleCodeChange(value: string) {
    setCodeTouched(true);
    setCode(value.toUpperCase());
  }

  function addRow() {
    rowKeyRef.current += 1;
    setRows((prev) => [...prev, { key: `row-${rowKeyRef.current}`, name: '' }]);
  }

  function updateRow(key: string, patch: Partial<SubRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setErrors((prev) => {
      if (!prev.rows?.[key]) return prev;
      const rest = { ...prev.rows };
      delete rest[key];
      return { ...prev, rows: rest };
    });
  }

  async function handleConfirm() {
    const nextErrors: typeof errors = { rows: {} };

    if (!name.trim()) nextErrors.name = 'Department name is required';
    if (!code.trim()) nextErrors.code = 'Department code is required';

    const seen = new Map<string, string>(); // lowercased name -> first row key
    for (const row of rows) {
      if (!row.name.trim()) {
        nextErrors.rows![row.key] = 'Sub-department name is required';
        continue;
      }
      const key = row.name.trim().toLowerCase();
      const firstKey = seen.get(key);
      if (firstKey) {
        nextErrors.rows![row.key] = 'Duplicate name -- already used above';
        nextErrors.rows![firstKey] = nextErrors.rows![firstKey] ?? 'Duplicate name -- used again below';
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
      await createDepartment.mutateAsync({
        name: name.trim(),
        code: code.trim(),
        headEmployeeId: managerId || undefined,
        subDepartments: rows
          .filter((r) => r.name.trim())
          .map((r) => ({ name: r.name.trim() })),
      });
      toast.success(`Department "${name.trim()}" created`);
      handleClose();
    } catch (err) {
      setErrors((e) => ({ ...e, general: apiErrorMessage(err) }));
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Department"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={createDepartment.isPending}>
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
          <FieldWrap label="Department Code" required error={errors.code} hint={!codeTouched ? 'Auto-filled from the name -- edit if needed' : undefined}>
            <Input value={code} onChange={(e) => handleCodeChange(e.target.value)} placeholder="e.g. RAD" />
          </FieldWrap>
          <FieldWrap label="Department Name" required error={errors.name}>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Radiology" />
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

          {rows.length === 0 ? (
            <p className="mt-3 text-xs text-text-muted italic">
              No sub-departments yet. Add one if this department has divisions (e.g. X-Ray, USG, MRI under Radiology).
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {rows.map((row) => (
                <div key={row.key} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      placeholder="Sub-department name"
                    />
                    {errors.rows?.[row.key] && <p className="mt-1 text-xs text-danger">{errors.rows[row.key]}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    title="Remove row"
                    className="mt-0.5 shrink-0 rounded-md p-2 text-text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
