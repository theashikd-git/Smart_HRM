'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Power, PowerOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { useAuthStore } from '@/lib/auth-store';
import { apiErrorMessage } from '@/lib/api';
import {
  useActivatePolicy,
  useDeactivatePolicy,
  usePolicies,
  useRecalculateAttendance,
} from '@/hooks/usePolicies';
import type { AttendancePolicy } from '@/types/policy';
import type { WorkbenchTab } from '@/types/workbench';
import { PolicyFormModal } from './PolicyFormModal';
import { describeRule, fmtDay, policyStatus, todayISO, type PolicyStatus } from './policy-helpers';

const STATUS_CLASS: Record<PolicyStatus, string> = {
  Active: 'text-success bg-success-soft',
  Scheduled: 'text-info bg-info-soft',
  Ending: 'text-warning bg-warning-soft',
  Inactive: '',
};

function scopeSummary(p: AttendancePolicy): string {
  const inc = p.scopes.filter((s) => s.kind === 'INCLUDE');
  const exc = p.scopes.filter((s) => s.kind === 'EXCLUDE');
  const count = (list: typeof inc) => {
    const n = (t: string) => list.filter((s) => s.targetType === t).length;
    const parts: string[] = [];
    if (n('DEPARTMENT')) parts.push(`${n('DEPARTMENT')} department${n('DEPARTMENT') > 1 ? 's' : ''}`);
    if (n('DESIGNATION')) parts.push(`${n('DESIGNATION')} designation${n('DESIGNATION') > 1 ? 's' : ''}`);
    if (n('EMPLOYEE')) parts.push(`${n('EMPLOYEE')} employee${n('EMPLOYEE') > 1 ? 's' : ''}`);
    return parts.join(', ');
  };
  const base = inc.length ? count(inc) : 'All employees';
  return exc.length ? `${base} · except ${count(exc)}` : base;
}

/**
 * Personnel > Organization > Policy. Attendance policies that turn repeated
 * grace-period or late arrivals into absent days. Admin and HR create, edit,
 * activate and deactivate them; the Director can only look. Changing the rules
 * of a policy that has already counted arrivals starts a new version, so
 * earlier periods are never recalculated on their own -- "Recalculate from
 * date" is the explicit way to re-run them.
 */
export function PolicyProgram({ tab }: { tab: WorkbenchTab }) {
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'HR';
  const { data: policies, isLoading } = usePolicies();
  const activate = useActivatePolicy();
  const deactivate = useDeactivatePolicy();
  const recalc = useRecalculateAttendance();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttendancePolicy | null>(null);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recalcFrom, setRecalcFrom] = useState(todayISO());
  const [showEnded, setShowEnded] = useState(false);

  const today = todayISO();
  const rows = useMemo(
    () => (policies ?? []).filter((p) => showEnded || policyStatus(p, today) !== 'Inactive'),
    [policies, showEnded, today],
  );
  const endedCount = (policies ?? []).filter((p) => policyStatus(p, today) === 'Inactive').length;

  async function handleDeactivate(p: AttendancePolicy) {
    if (!confirm(`Deactivate "${p.name}"? It stops applying after today. Earlier days keep the result they already have.`)) return;
    try {
      await deactivate.mutateAsync({ id: p.id });
      toast.success('Policy deactivated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleActivate(p: AttendancePolicy) {
    try {
      await activate.mutateAsync({ id: p.id });
      toast.success('Policy activated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleRecalc() {
    if (!recalcFrom) return;
    try {
      const r = await recalc.mutateAsync({ fromDate: recalcFrom });
      toast.success(
        `Recalculated ${r.recalculated} day${r.recalculated === 1 ? '' : 's'}${r.skippedCorrected ? ` (${r.skippedCorrected} manually corrected left as is)` : ''}`,
      );
      setRecalcOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        canEdit ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setRecalcOpen(true)}>
              <RefreshCw className="h-4 w-4" />
              Recalculate from date
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Policy
            </Button>
          </div>
        ) : undefined
      }
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-xs text-text-muted">
            {rows.length} polic{rows.length === 1 ? 'y' : 'ies'}
            {!canEdit && ' · view only'}
          </p>
          {endedCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} />
              Show ended ({endedCount})
            </label>
          )}
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Policy</Th>
              <Th>Type</Th>
              <Th>Rule</Th>
              <Th>Applies to</Th>
              <Th>Effective</Th>
              <Th>Status</Th>
              {canEdit && <Th className="w-28 text-center">Action</Th>}
            </tr>
          </Thead>
          <Tbody>
            {rows.map((p) => {
              const status = policyStatus(p, today);
              return (
                <Tr key={p.id}>
                  <Td className="font-medium text-text-primary">
                    {p.name}
                    {p.description && <p className="mt-0.5 text-xs font-normal text-text-muted">{p.description}</p>}
                  </Td>
                  <Td>
                    <Badge className={p.type === 'GRACE' ? 'text-warning bg-warning-soft' : 'text-danger bg-danger-soft'}>
                      {p.type === 'GRACE' ? 'Grace' : 'Late'}
                    </Badge>
                  </Td>
                  <Td className="max-w-xs text-xs text-text-secondary">{describeRule(p.type, p.params)}</Td>
                  <Td className="text-xs">{scopeSummary(p)}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    {fmtDay(p.effectiveFrom)}
                    {p.effectiveTo ? ` – ${fmtDay(p.effectiveTo)}` : ' onward'}
                  </Td>
                  <Td>
                    <Badge className={STATUS_CLASS[status]}>{status}</Badge>
                  </Td>
                  {canEdit && (
                    <Td className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {status !== 'Inactive' && (
                          <button
                            onClick={() => {
                              setEditing(p);
                              setFormOpen(true);
                            }}
                            title="Edit policy"
                            className="rounded p-1 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {status === 'Active' || status === 'Scheduled' ? (
                          <button
                            onClick={() => handleDeactivate(p)}
                            title="Deactivate policy"
                            className="rounded p-1 text-text-muted hover:bg-danger-soft hover:text-danger"
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          status === 'Inactive' && (
                            <button
                              onClick={() => handleActivate(p)}
                              title="Activate policy"
                              className="rounded p-1 text-text-muted hover:bg-success-soft hover:text-success"
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>

        {!isLoading && rows.length === 0 && (
          <EmptyState
            icon={<ShieldCheck className="h-8 w-8" />}
            title="No attendance policies yet"
            subtitle={
              canEdit
                ? 'Add one to turn repeated grace-period or late arrivals into absent days.'
                : 'Admin or HR can add one.'
            }
          />
        )}
      </Card>

      <PolicyFormModal open={formOpen} onClose={() => setFormOpen(false)} policy={editing} />

      <Modal
        open={recalcOpen}
        onClose={() => setRecalcOpen(false)}
        title="Recalculate from date"
        subtitle="Re-runs the daily attendance rules from the raw punches."
        footer={
          <>
            <Button variant="outline" onClick={() => setRecalcOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecalc} loading={recalc.isPending}>
              Recalculate
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FieldWrap label="From date" required>
            <Input type="date" value={recalcFrom} onChange={(e) => setRecalcFrom(e.target.value)} />
          </FieldWrap>
          <p className="text-xs text-text-muted">
            Every day from this date to today is recalculated for all employees using the policies, shifts and exemptions as they are now, and
            policy absent days are rebuilt. Days you corrected by hand are left as they are. Nothing is recalculated automatically when a
            policy changes.
          </p>
        </div>
      </Modal>
    </ProgramWorkspace>
  );
}
