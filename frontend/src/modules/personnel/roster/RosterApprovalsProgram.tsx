'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, ClipboardCheck, ArrowRight } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import {
  useRosterPendingList,
  useApproveRosterAssignment,
  useRejectRosterAssignment,
} from '@/hooks/useRoster';
import { useShifts } from '@/hooks/useShifts';
import { useAuthStore } from '@/lib/auth-store';
import { apiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PendingRosterItem } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

type Kind = 'ALL' | 'CHANGE' | 'REMOVAL';

const keyOf = (i: PendingRosterItem) => `${i.employeeId}|${i.date.slice(0, 10)}`;

function dayLabel(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Personnel > Roster Approvals -- where HR/Admin decides on what Managers and
 * Supervisors can't change on their own: edits to a date that has already
 * passed (shown as a change from what was there to what they want) and
 * requests to clear one. Approve applies it; Reject keeps/restores what was
 * there before. Approvals used to be hidden inside individual Roster cells;
 * this lists everything waiting, with who asked and why, in one place.
 */
export function RosterApprovalsProgram({ tab }: { tab: WorkbenchTab }) {
  const role = useAuthStore((s) => s.user?.role);
  const canDecide = role === 'ADMIN' || role === 'HR';

  const { data, isLoading } = useRosterPendingList();
  const { data: shifts } = useShifts();
  const approve = useApproveRosterAssignment();
  const reject = useRejectRosterAssignment();

  const [kind, setKind] = useState<Kind>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<PendingRosterItem[] | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const shiftById = useMemo(() => new Map((shifts ?? []).map((s) => [s.id, s])), [shifts]);

  function duty(type?: string | null, shift?: { name: string; startTime: string; endTime: string } | null, shiftId?: string | null) {
    if (type === 'OFF') return 'Day Off';
    const s = shift ?? (shiftId ? shiftById.get(shiftId) : undefined);
    return s ? `${s.name} (${s.startTime}–${s.endTime})` : type === 'SHIFT' ? 'Shift' : 'Nothing';
  }

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((i) => {
      if (kind === 'CHANGE' && i.pendingRemoval) return false;
      if (kind === 'REMOVAL' && !i.pendingRemoval) return false;
      if (!q) return true;
      return (
        i.employee.fullName.toLowerCase().includes(q) ||
        i.employee.employeeCode.toLowerCase().includes(q) ||
        (i.employee.department?.name ?? '').toLowerCase().includes(q) ||
        (i.assignedBy?.fullName ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, kind, search]);

  const removalCount = (data ?? []).filter((i) => i.pendingRemoval).length;
  const changeCount = (data?.length ?? 0) - removalCount;
  const allTicked = items.length > 0 && items.every((i) => selected.includes(keyOf(i)));
  const chosen = items.filter((i) => selected.includes(keyOf(i)));

  function toggle(k: string) {
    setSelected((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

  async function decide(list: PendingRosterItem[], action: 'approve' | 'reject', note?: string) {
    if (list.length === 0) return;
    setBusy(true);
    const results = await Promise.allSettled(
      list.map((i) => {
        const payload = { employeeId: i.employeeId, date: i.date.slice(0, 10), note };
        return action === 'approve' ? approve.mutateAsync(payload) : reject.mutateAsync(payload);
      }),
    );
    setBusy(false);
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    const done = results.length - failed.length;
    if (done > 0) toast.success(`${done} ${action === 'approve' ? 'approved' : 'rejected'}`);
    if (failed.length > 0) toast.error(`${failed.length} failed: ${apiErrorMessage(failed[0].reason)}`);
    const okKeys = new Set(list.filter((_, idx) => results[idx].status === 'fulfilled').map(keyOf));
    setSelected((cur) => cur.filter((k) => !okKeys.has(k)));
  }

  async function confirmReject() {
    if (!rejecting) return;
    const list = rejecting;
    setRejecting(null);
    await decide(list, 'reject', rejectNote.trim() || undefined);
    setRejectNote('');
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        canDecide && chosen.length > 0 ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setRejecting(chosen)} disabled={busy}>
              <X className="h-3.5 w-3.5" />
              Reject selected ({chosen.length})
            </Button>
            <Button size="sm" onClick={() => decide(chosen, 'approve')} loading={busy}>
              <Check className="h-3.5 w-3.5" />
              Approve selected ({chosen.length})
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Waiting for approval" value={data?.length ?? 0} />
        <Stat label="Duty changes" value={changeCount} />
        <Stat label="Clear requests" value={removalCount} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full sm:w-64">
            <Input placeholder="Search employee, department, requester" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full sm:w-44">
            <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="ALL">All requests</option>
              <option value="CHANGE">Duty changes</option>
              <option value="REMOVAL">Clear requests</option>
            </Select>
          </div>
          <p className="ml-auto text-xs text-text-muted">
            {canDecide ? 'Past-date edits by Managers/Supervisors wait here for your decision.' : 'View only -- Admin/HR decide.'}
          </p>
        </div>

        <Table>
          <Thead>
            <tr>
              {canDecide && (
                <Th className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allTicked}
                    onChange={() => setSelected(allTicked ? [] : items.map(keyOf))}
                    className="h-4 w-4 accent-[var(--color-accent,#0d9488)]"
                  />
                </Th>
              )}
              <Th>Employee</Th>
              <Th>Date</Th>
              <Th>Request</Th>
              <Th>Requested by</Th>
              <Th>Reason</Th>
              {canDecide && <Th></Th>}
            </tr>
          </Thead>
          <Tbody>
            {items.map((i) => {
              const k = keyOf(i);
              const hadBefore = i.previousType ? duty(i.previousType, null, i.previousShiftId) : null;
              return (
                <Tr key={k}>
                  {canDecide && (
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${i.employee.fullName}`}
                        checked={selected.includes(k)}
                        onChange={() => toggle(k)}
                        className="h-4 w-4 accent-[var(--color-accent,#0d9488)]"
                      />
                    </Td>
                  )}
                  <Td>
                    <p className="text-[13px] font-medium text-text-primary">{i.employee.fullName}</p>
                    <p className="text-[11px] text-text-muted">
                      {i.employee.employeeCode}
                      {i.employee.department ? ` · ${i.employee.department.name}` : ''}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{dayLabel(i.date)}</Td>
                  <Td>
                    {i.pendingRemoval ? (
                      <div className="text-xs">
                        <span className="inline-flex rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                          Clear duty
                        </span>
                        <p className="mt-1 text-text-secondary">Currently: {duty(i.type, i.shift, i.shiftId)}</p>
                      </div>
                    ) : (
                      <div className="text-xs">
                        <span className="inline-flex rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                          {hadBefore ? 'Change' : 'New duty'}
                        </span>
                        <p className="mt-1 flex flex-wrap items-center gap-1 text-text-secondary">
                          {hadBefore && (
                            <>
                              <span className="line-through">{hadBefore}</span>
                              <ArrowRight className="h-3 w-3 text-text-muted" />
                            </>
                          )}
                          <span className="font-medium text-text-primary">{duty(i.type, i.shift, i.shiftId)}</span>
                        </p>
                      </div>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {i.assignedBy ? (
                      <>
                        <p className="text-text-primary">{i.assignedBy.fullName}</p>
                        <p className="text-[11px] text-text-muted capitalize">{i.assignedBy.role.toLowerCase().replace('_', ' ')}</p>
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="max-w-xs text-xs text-text-secondary">{i.hrNote || '—'}</Td>
                  {canDecide && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting([i])}>
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => decide([i], 'approve')}>
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            title={(data?.length ?? 0) === 0 ? 'Nothing is waiting for approval' : 'No requests match your filter'}
            subtitle={
              (data?.length ?? 0) === 0 ? 'Manager and Supervisor requests for past dates will show up here.' : undefined
            }
          />
        )}
      </Card>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.length ?? 0} request${rejecting?.length === 1 ? '' : 's'}`}
        subtitle="A rejected change goes back to what was there before; a rejected clear request keeps the duty."
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmReject} loading={busy}>
              Reject
            </Button>
          </>
        }
      >
        <FieldWrap label="Note (optional)" hint="Saved in the audit log.">
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} placeholder="Why is this being rejected?" />
        </FieldWrap>
      </Modal>
    </ProgramWorkspace>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-white px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <span className={cn('text-xl font-semibold leading-tight', value > 0 ? 'text-text-primary' : 'text-text-muted')}>{value}</span>
    </div>
  );
}
