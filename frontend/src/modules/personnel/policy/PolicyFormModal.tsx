'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { useCreatePolicy, useUpdatePolicy } from '@/hooks/usePolicies';
import { useDepartments } from '@/hooks/useDepartments';
import { useDesignations } from '@/hooks/useDesignations';
import { useEmployees } from '@/hooks/useEmployees';
import { apiErrorMessage } from '@/lib/api';
import type { AttendancePolicy, PolicyParams, PolicyScope, PolicyScopeKind, PolicyTargetType, PolicyType } from '@/types/policy';
import { DEFAULT_PARAMS, describeRule, fmtDay, todayISO } from './policy-helpers';

interface Props {
  open: boolean;
  onClose: () => void;
  /** null = create a new policy. */
  policy: AttendancePolicy | null;
}

const TARGET_LABEL: Record<PolicyTargetType, string> = {
  DEPARTMENT: 'Department',
  DESIGNATION: 'Designation',
  EMPLOYEE: 'Employee',
};

/** Picks departments / designations / individual employees for one scope list (include or exclude). */
function ScopePicker({
  kind,
  value,
  onChange,
}: {
  kind: PolicyScopeKind;
  value: PolicyScope[];
  onChange: (next: PolicyScope[]) => void;
}) {
  const { data: departments } = useDepartments();
  const { data: designations } = useDesignations();
  const { data: employees } = useEmployees({ status: 'ACTIVE', pageSize: 1000 });
  const [targetType, setTargetType] = useState<PolicyTargetType>('DEPARTMENT');
  const [targetId, setTargetId] = useState('');

  const options = useMemo(() => {
    if (targetType === 'DEPARTMENT') return (departments ?? []).map((d) => ({ id: d.id, label: d.name }));
    if (targetType === 'DESIGNATION') return (designations ?? []).map((d) => ({ id: d.id, label: d.title }));
    return (employees?.items ?? []).map((e) => ({ id: e.id, label: `${e.fullName} (${e.employeeCode})` }));
  }, [targetType, departments, designations, employees]);

  const labelOf = (s: PolicyScope) => {
    if (s.targetType === 'DEPARTMENT') return departments?.find((d) => d.id === s.targetId)?.name;
    if (s.targetType === 'DESIGNATION') return designations?.find((d) => d.id === s.targetId)?.title;
    const e = employees?.items.find((x) => x.id === s.targetId);
    return e ? `${e.fullName} (${e.employeeCode})` : undefined;
  };

  function add() {
    if (!targetId) return;
    if (value.some((s) => s.targetType === targetType && s.targetId === targetId)) return;
    onChange([...value, { kind, targetType, targetId }]);
    setTargetId('');
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value as PolicyTargetType);
            setTargetId('');
          }}
          className="w-36 shrink-0"
        >
          {(Object.keys(TARGET_LABEL) as PolicyTargetType[]).map((t) => (
            <option key={t} value={t}>
              {TARGET_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="outline" onClick={add} disabled={!targetId}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={`${s.targetType}:${s.targetId}`}
              className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-text-primary"
            >
              <span className="text-text-muted">{TARGET_LABEL[s.targetType]}:</span> {labelOf(s) ?? '…'}
              <button
                type="button"
                title="Remove"
                onClick={() => onChange(value.filter((x) => !(x.targetType === s.targetType && x.targetId === s.targetId)))}
                className="rounded-full p-0.5 text-text-muted hover:bg-danger-soft hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Add / edit an attendance policy. Changing the rules of a policy already in use starts a new version from the chosen date. */
export function PolicyFormModal({ open, onClose, policy }: Props) {
  const create = useCreatePolicy();
  const update = useUpdatePolicy();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PolicyType>('GRACE');
  const [params, setParams] = useState<PolicyParams>(DEFAULT_PARAMS.GRACE);
  const [resetDays, setResetDays] = useState('7');
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [includes, setIncludes] = useState<PolicyScope[]>([]);
  const [excludes, setExcludes] = useState<PolicyScope[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (policy) {
      setName(policy.name);
      setDescription(policy.description ?? '');
      setType(policy.type);
      setParams(policy.params);
      setResetDays(policy.params.resetAfterDays ? String(policy.params.resetAfterDays) : '');
      setEffectiveFrom(todayISO());
      setIncludes(policy.scopes.filter((s) => s.kind === 'INCLUDE').map(({ kind, targetType, targetId }) => ({ kind, targetType, targetId })));
      setExcludes(policy.scopes.filter((s) => s.kind === 'EXCLUDE').map(({ kind, targetType, targetId }) => ({ kind, targetType, targetId })));
    } else {
      setName('');
      setDescription('');
      setType('GRACE');
      setParams(DEFAULT_PARAMS.GRACE);
      setResetDays(String(DEFAULT_PARAMS.GRACE.resetAfterDays ?? ''));
      setEffectiveFrom(todayISO());
      setIncludes([]);
      setExcludes([]);
    }
  }, [open, policy]);

  function pickType(next: PolicyType) {
    setType(next);
    setParams(DEFAULT_PARAMS[next]);
    setResetDays(DEFAULT_PARAMS[next].resetAfterDays ? String(DEFAULT_PARAMS[next].resetAfterDays) : '');
  }

  function setParam<K extends keyof PolicyParams>(key: K, value: PolicyParams[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  const finalParams: PolicyParams = {
    ...params,
    allowed: type === 'LATE' ? 0 : params.allowed,
    resetAfterDays: params.resetEnabled && resetDays ? Number(resetDays) : null,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Give the policy a name.');
    if (!(finalParams.windowSize >= 1) || !(finalParams.convertEvery >= 1)) return setError('Window size and "every" must be at least 1.');
    const payload = { name: name.trim(), description: description.trim() || undefined, params: finalParams, scopes: [...includes, ...excludes] };
    try {
      if (policy) {
        const sameScopes = (a: PolicyScope[], b: PolicyScope[]) =>
          JSON.stringify(a.map((s) => `${s.kind}|${s.targetType}|${s.targetId}`).sort()) ===
          JSON.stringify(b.map((s) => `${s.kind}|${s.targetType}|${s.targetId}`).sort());
        const rulesChanged =
          JSON.stringify({ ...policy.params, resetAfterDays: policy.params.resetAfterDays ?? null }) !== JSON.stringify({ ...finalParams, resetAfterDays: finalParams.resetAfterDays ?? null }) ||
          !sameScopes(policy.scopes as PolicyScope[], payload.scopes);
        await update.mutateAsync({ id: policy.id, ...payload, effectiveFrom: rulesChanged ? effectiveFrom : undefined });
        toast.success('Policy updated');
      } else {
        await create.mutateAsync({ ...payload, type, effectiveFrom });
        toast.success('Policy created');
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={policy ? 'Edit Policy' : 'Add Policy'}
      subtitle="Decides when repeated grace-period or late arrivals become an absent day."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="policy-form" loading={create.isPending || update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="policy-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrap label="Policy Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly grace limit" autoFocus />
          </FieldWrap>
          <FieldWrap label="Type" required hint={policy ? 'The type cannot be changed once created.' : 'Grace = arrived within the shift grace minutes. Late = arrived after them.'}>
            <Select value={type} onChange={(e) => pickType(e.target.value as PolicyType)} disabled={!!policy}>
              <option value="GRACE">Grace-period arrivals</option>
              <option value="LATE">Late arrivals</option>
            </Select>
          </FieldWrap>
        </div>

        <FieldWrap label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[56px]" />
        </FieldWrap>

        <div className="rounded-lg border border-line p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Counting rule</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldWrap label="Counting window">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={params.windowSize}
                  onChange={(e) => setParam('windowSize', Number(e.target.value))}
                  className="w-20"
                />
                <Select value={params.windowUnit} onChange={(e) => setParam('windowUnit', e.target.value as PolicyParams['windowUnit'])}>
                  <option value="DAYS">Days</option>
                  <option value="WEEKS">Weeks (Mon–Sun)</option>
                  <option value="MONTHS">Months (calendar)</option>
                </Select>
              </div>
            </FieldWrap>
            {type === 'GRACE' && (
              <FieldWrap label="Allowed per window" hint="Free arrivals before any penalty">
                <Input type="number" min={0} value={params.allowed} onChange={(e) => setParam('allowed', Number(e.target.value))} />
              </FieldWrap>
            )}
            <FieldWrap label={type === 'GRACE' ? 'Every extra arrival count' : 'Every late arrival count'} hint="= 1 absent day">
              <Input type="number" min={1} value={params.convertEvery} onChange={(e) => setParam('convertEvery', Number(e.target.value))} />
            </FieldWrap>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={params.resetEnabled} onChange={(e) => setParam('resetEnabled', e.target.checked)} />
              Reset counters
            </label>
            {params.resetEnabled && (
              <FieldWrap label="Reset every (days)" hint="Blank = at the end of each window">
                <Input type="number" min={1} value={resetDays} onChange={(e) => setResetDays(e.target.value)} />
              </FieldWrap>
            )}
          </div>
          <p className="mt-3 rounded-md bg-surface-sunken px-3 py-2 text-xs text-text-secondary">{describeRule(type, finalParams)}</p>
        </div>

        <div className="rounded-lg border border-line p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Applies to</p>
          <p className="mb-2 text-xs text-text-muted">Leave empty to apply to all employees. When several policies match someone, the most specific one wins (employee, then designation, then department, then everyone).</p>
          <ScopePicker kind="INCLUDE" value={includes} onChange={setIncludes} />
        </div>

        <div className="rounded-lg border border-line p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Except</p>
          <p className="mb-2 text-xs text-text-muted">These are never covered by this policy, even if they match the list above.</p>
          <ScopePicker kind="EXCLUDE" value={excludes} onChange={setExcludes} />
        </div>

        <FieldWrap
          label={policy ? 'Rule changes apply from' : 'Effective from'}
          hint={
            policy
              ? `If you change the rules or who it applies to, a new version starts on this date; ${fmtDay(policy.effectiveFrom)} to the day before keeps the old rules. Earlier days are not recalculated.`
              : 'Arrivals before this date are never counted. Nothing from earlier days is recalculated.'
          }
        >
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="sm:w-48" />
        </FieldWrap>
      </form>
    </Modal>
  );
}
