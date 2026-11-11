'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarCheck,
  CalendarOff,
  Lock,
  Clock3,
  CalendarPlus,
  Save,
  Shuffle,
  Dices,
  type LucideIcon,
} from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Form';
import { useDepartments } from '@/hooks/useDepartments';
import { useShifts } from '@/hooks/useShifts';
import {
  useRosterWeek,
  useSaveRosterBatch,
  useApproveRosterAssignment,
  type RosterChange,
} from '@/hooks/useRoster';
import { apiErrorMessage } from '@/lib/api';
import { attendanceStatusColors, cn, initials } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { BulkAssignModal, type BulkPlan, type AutoPlan } from './BulkAssignModal';
import { generateRoster } from './autoRoster';
import type { RosterAssignment, RosterDayType, RosterEmployee } from '@/types';
import type { WorkbenchTab } from '@/types/workbench';

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// A handful of tasteful, on-brand pill colors that individual shifts cycle
// through (shifts are user-defined -- "Morning" isn't special to the schema,
// so there's no fixed color to key off; the same shift always lands on the
// same color within one page load since the cycle is keyed by sorted shift
// id order, not by render position).
const SHIFT_PALETTE = [
  { bg: 'bg-accent-soft', text: 'text-accent-dark', dot: 'bg-accent' },
  { bg: 'bg-info-soft', text: 'text-info', dot: 'bg-info' },
  { bg: 'bg-warning-soft', text: 'text-warning', dot: 'bg-warning' },
  { bg: 'bg-success-soft', text: 'text-success', dot: 'bg-success' },
];

const OFF_COLORS = { bg: 'bg-white', text: 'text-text-secondary', dot: 'bg-text-muted' };

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function monthStartOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

type ViewMode = 'week' | 'month';

/** Edits are staged here (key = "employeeId|YYYY-MM-DD") until Save. */
type Draft = Record<string, RosterChange>;

/** Adds one staged change to a draft. A change that just puts the cell back
 *  to what's already saved is dropped instead, so "unsaved changes" only ever
 *  counts real differences. Pure -- returns a new draft. */
function applyChange(draft: Draft, saved: RosterAssignment | undefined, change: RosterChange): Draft {
  const key = `${change.employeeId}|${change.date}`;
  const next = { ...draft };
  if (change.action === 'CLEAR') {
    if (!saved) delete next[key];
    else next[key] = change;
  } else {
    const same =
      saved &&
      saved.status === 'APPROVED' &&
      !saved.pendingRemoval &&
      saved.type === change.type &&
      (saved.shiftId ?? null) === (change.shiftId ?? null);
    if (same) delete next[key];
    else next[key] = change;
  }
  return next;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(d.getDate() + n);
  return nd;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The Roster program: a Week or full-Month (default) calendar of every active
 * employee's planned shift, with real attendance status layered in for days that have already
 * happened. Distinct from Attendance (what actually happened) -- this is
 * what's *planned*, and clicking a cell assigns or clears that plan.
 *
 * Approval only kicks in for a date that's already passed: assigning or
 * changing today's or a future duty takes effect immediately for anyone
 * (Manager/Supervisor included), no reason and no HR approval needed. A
 * past date always needs a reason from whoever touches it -- HR/Admin's
 * applies right away, while a Manager/Supervisor's instead files a
 * request (a change goes PENDING, a clear sets isPendingRemoval) that
 * isn't final until HR/Admin approves it here, and isn't yet visible on
 * the employee's own dashboard either (see useMyRoster/MyCalendarCard).
 *
 * Month view shows every day of the month in compact cells, and the
 * "Assign Multiple" tool fills many employees x many days in one go
 * (BulkAssignModal) so a whole month's roster isn't built cell by cell, and
 * the shuffle button on a row sets one random day off per week for that
 * employee.
 *
 * Nothing here is saved as you click: every assign / day off / clear / random
 * off is only staged (highlighted, with an "unsaved changes" bar), and the
 * manager reviews it and presses Save to confirm -- or Discard to drop it.
 */
export function RosterProgram({ tab }: { tab: WorkbenchTab }) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(() => monthStartOf(new Date()));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [departmentId, setDepartmentId] = useState('');
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const role = useAuthStore((s) => s.user?.role);
  const isHrOrAdmin = role === 'ADMIN' || role === 'HR';
  // MANAGER and SUPERVISOR are both department-scoped assigners: each
  // only ever sees/manages their own department's team, and either one
  // can still act on a past-date cell -- it just files a request awaiting
  // HR/Admin's approval instead of taking effect right away.
  const isRestrictedAssigner = role === 'MANAGER' || role === 'SUPERVISOR';

  const compact = viewMode === 'month';
  const days = useMemo(() => {
    if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const count = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(y, m, i + 1));
  }, [viewMode, anchor]);
  const startDate = isoDate(days[0]);
  const endDate = isoDate(days[days.length - 1]);
  const todayIso = isoDate(new Date());
  const gridCols = compact ? `190px repeat(${days.length}, 56px)` : '236px repeat(7, minmax(0, 1fr))';
  const gridMinWidth = compact ? 190 + days.length * 56 : 1180;

  function switchMode(next: ViewMode) {
    if (next === viewMode) return;
    const today = new Date();
    const sameMonth = anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();
    const base = sameMonth ? today : anchor;
    setAnchor(next === 'month' ? monthStartOf(base) : mondayOf(base));
    setViewMode(next);
    setOpenCell(null);
  }
  function step(dir: 1 | -1) {
    setAnchor((a) => (viewMode === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
    setOpenCell(null);
  }
  function goToday() {
    setAnchor(viewMode === 'week' ? mondayOf(new Date()) : monthStartOf(new Date()));
    setOpenCell(null);
  }
  function openBulk(ids: string[]) {
    setBulkEmployeeIds(ids);
    setBulkOpen(true);
  }
  const rangeLabel =
    viewMode === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${shortDate(days[0])} – ${shortDate(days[6])}`;

  const { data: departments } = useDepartments();
  const { data: shifts } = useShifts();
  const { data, isLoading } = useRosterWeek({ startDate, endDate, departmentId: departmentId || undefined });
  const saveBatch = useSaveRosterBatch();
  const approveAssignment = useApproveRosterAssignment();

  const sortedShiftIds = useMemo(() => (shifts ?? []).map((s) => s.id).sort(), [shifts]);
  function shiftColors(shiftId: string) {
    const idx = sortedShiftIds.indexOf(shiftId);
    return SHIFT_PALETTE[idx >= 0 ? idx % SHIFT_PALETTE.length : 0];
  }

  const assignmentMap = useMemo(() => {
    const map = new Map<string, RosterAssignment>();
    for (const a of data?.assignments ?? []) map.set(`${a.employeeId}|${a.date.slice(0, 10)}`, a);
    return map;
  }, [data]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of data?.attendance ?? []) map.set(`${a.employeeId}|${a.date.slice(0, 10)}`, a.status);
    return map;
  }, [data]);

  const shiftById = useMemo(() => new Map((shifts ?? []).map((s) => [s.id, s])), [shifts]);
  const draftCount = Object.keys(draft).length;

  // Warn before leaving the page with edits that were never saved.
  useEffect(() => {
    if (draftCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draftCount]);

  /** What a cell will look like once Save is pressed: the staged change if
   *  there is one, otherwise what's saved. */
  function effective(key: string, d: Draft = draft): { type: RosterDayType; shiftId?: string } | undefined {
    const dr = d[key];
    if (dr) return dr.action === 'CLEAR' ? undefined : { type: dr.type as RosterDayType, shiftId: dr.shiftId };
    const saved = assignmentMap.get(key);
    return saved ? { type: saved.type, shiftId: saved.shiftId ?? undefined } : undefined;
  }

  const employees = data?.employees ?? [];
  const shiftsAssigned = (data?.assignments ?? []).filter((a) => a.type === 'SHIFT').length;
  const daysOff = (data?.assignments ?? []).filter((a) => a.type === 'OFF').length;
  const pendingCount = (data?.assignments ?? []).filter((a) => a.status === 'PENDING').length;

  function closeCell(key: string) {
    setOpenCell(null);
    setNoteDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  function stage(employeeId: string, date: string, change: Omit<RosterChange, 'employeeId' | 'date'>) {
    setDraft((d) => applyChange(d, assignmentMap.get(`${employeeId}|${date}`), { employeeId, date, ...change }));
  }

  function handlePick(key: string, employeeId: string, date: string, type: RosterDayType, shiftId?: string, hrNote?: string) {
    closeCell(key);
    stage(employeeId, date, { action: 'SET', type, shiftId, hrNote });
  }

  function handleClear(key: string, employeeId: string, date: string, hrNote?: string) {
    closeCell(key);
    stage(employeeId, date, { action: 'CLEAR', hrNote });
  }

  /** One random day off in every week of the view, for one employee. Weeks
   *  that already have a day off are left alone, past days are never touched,
   *  and a day with no duty yet is preferred over replacing one. Pressing it
   *  again re-shuffles the random days it staged before. */
  function handleRandomOff(emp: RosterEmployee) {
    // Drop this employee's earlier staged day-offs so a second click re-rolls.
    let next: Draft = {};
    for (const [k, c] of Object.entries(draft)) {
      if (c.employeeId === emp.id && c.action === 'SET' && c.type === 'OFF') continue;
      next[k] = c;
    }

    const weeks = new Map<string, Date[]>();
    for (const day of days) {
      const wk = isoDate(mondayOf(day));
      weeks.set(wk, [...(weeks.get(wk) ?? []), day]);
    }

    let set = 0;
    let skipped = 0;
    for (const wd of weeks.values()) {
      // A sliver of a week at the edge of the month (under 4 days) is left
      // for the neighbouring month's view, so no week ends up with two.
      if (wd.length < 4) continue;
      if (wd.some((day) => effective(`${emp.id}|${isoDate(day)}`, next)?.type === 'OFF')) {
        skipped++;
        continue;
      }
      const candidates = wd.filter((day) => isoDate(day) >= todayIso);
      if (candidates.length === 0) continue;
      const empty = candidates.filter((day) => !effective(`${emp.id}|${isoDate(day)}`, next));
      const pool = empty.length > 0 ? empty : candidates;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const date = isoDate(pick);
      next = applyChange(next, assignmentMap.get(`${emp.id}|${date}`), { employeeId: emp.id, date, action: 'SET', type: 'OFF' });
      set++;
    }

    setDraft(next);
    setOpenCell(null);
    if (set > 0) {
      toast.success(`${set} random day${set === 1 ? '' : 's'} off for ${emp.fullName} -- change any you like, then press Save`);
    } else {
      toast(skipped > 0 ? 'Every week already has a day off.' : 'No upcoming days to give a day off.');
    }
  }

  function handleBulkApply(plan: BulkPlan) {
    let next = draft;
    let staged = 0;
    let skipped = 0;
    for (const employeeId of plan.employeeIds) {
      for (const date of plan.dates) {
        if (plan.skipExisting && effective(`${employeeId}|${date}`, next)) {
          skipped++;
          continue;
        }
        next = applyChange(next, assignmentMap.get(`${employeeId}|${date}`), {
          employeeId,
          date,
          action: 'SET',
          type: plan.type,
          shiftId: plan.shiftId,
          hrNote: date < todayIso ? plan.hrNote : undefined,
        });
        staged++;
      }
    }
    setDraft(next);
    toast.success(`${staged} added${skipped ? ` (${skipped} skipped, already had a duty)` : ''} -- review, then press Save`);
  }

  /** Makes the random roster (see autoRoster.ts) for one or more groups of
   *  people and stages it. Nothing is saved -- the manager can change any
   *  cell, re-generate, or Discard, then press Save. */
  function runAuto(plans: AutoPlan[]) {
    const people = new Set(plans.flatMap((p) => p.employeeIds));
    const dates = new Set(plans.flatMap((p) => p.dates));
    // Start from the draft without earlier unsaved edits for these people in
    // these days, so generating again simply re-rolls.
    let next: Draft = {};
    for (const [k, c] of Object.entries(draft)) {
      if (people.has(c.employeeId) && dates.has(c.date)) continue;
      next[k] = c;
    }
    const base = next;
    let shiftsMade = 0;
    let offsMade = 0;
    const short: { date: string; shiftId: string; missing: number }[] = [];
    for (const plan of plans) {
      const res = generateRoster({
        ...plan,
        lookup: (employeeId, date) => effective(`${employeeId}|${date}`, base),
      });
      shiftsMade += res.shifts;
      offsMade += res.offs;
      short.push(...res.shortfalls);
      for (const c of res.cells) {
        next = applyChange(next, assignmentMap.get(`${c.employeeId}|${c.date}`), {
          employeeId: c.employeeId,
          date: c.date,
          action: 'SET',
          type: c.type,
          shiftId: c.shiftId,
        });
      }
    }
    setDraft(next);

    if (shiftsMade + offsMade === 0) {
      toast('Nothing to fill -- those days already have duties.');
      return;
    }
    toast.success(`Roster made: ${shiftsMade} shifts and ${offsMade} days off -- change anything you like, then press Save`);
    if (short.length > 0) {
      const first = short[0];
      const name = shiftById.get(first.shiftId)?.name ?? 'a shift';
      toast(
        `Not enough people on ${short.length} shift-day${short.length === 1 ? '' : 's'} (e.g. ${first.date} ${name} is ${first.missing} short). Lower the numbers or add staff.`,
        { duration: 8000 },
      );
    }
  }

  function handleAuto(plan: AutoPlan) {
    runAuto([plan]);
  }

  /** "Random Roster": one click, no questions. Everyone on screen gets one
   *  random day off a week and a fair mix of their department's shifts
   *  (mornings, evenings...) for the rest of the period -- today onwards
   *  only. Each shift gets an equal share of the people working. */
  function handleRandomRoster() {
    const dates = days.map(isoDate).filter((d) => d >= todayIso);
    if (employees.length === 0) {
      toast('No employees to make a roster for.');
      return;
    }
    if (dates.length === 0) {
      toast('This period is already in the past -- go to today or a later month.');
      return;
    }
    // Group by department so each person only gets shifts that fit them.
    const groups = new Map<string, RosterEmployee[]>();
    for (const e of employees) {
      const k = e.department?.id ?? '';
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const plans: AutoPlan[] = [];
    let noShifts = 0;
    for (const [deptId, members] of groups) {
      const usable = (shifts ?? [])
        .filter((sh) => !sh.departmentId || sh.departmentId === deptId)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (usable.length === 0) {
        noShifts += members.length;
        continue;
      }
      // Everyone but the one person off each day is working: split them evenly.
      const working = Math.max(1, members.length - Math.ceil(members.length / 7));
      const base = Math.floor(working / usable.length);
      const rem = working % usable.length;
      plans.push({
        employeeIds: members.map((m) => m.id),
        dates,
        shifts: usable.map((sh, i) => ({ id: sh.id, count: base + (i < rem ? 1 : 0) })),
        weeklyOff: true,
        keepExisting: true,
        fillEveryone: true,
      });
    }
    if (plans.length === 0) {
      toast.error('No shifts are set up for these employees yet -- ask HR to add shifts for the department.');
      return;
    }
    if (noShifts > 0) toast(`${noShifts} employee${noShifts === 1 ? ' has' : 's have'} no shifts set up and were skipped.`);
    runAuto(plans);
  }

  async function handleSave() {
    const entries = Object.values(draft);
    if (entries.length === 0) return;
    try {
      let applied = 0;
      let pending = 0;
      const failed: { employeeId: string; date: string; message: string }[] = [];
      // The backend takes up to 400 changes per request.
      for (let i = 0; i < entries.length; i += 400) {
        const res = await saveBatch.mutateAsync(entries.slice(i, i + 400));
        applied += res.applied;
        pending += res.pending;
        failed.push(...res.failed);
      }
      // Whatever saved leaves the draft; anything that failed stays staged.
      const failedKeys = new Set(failed.map((f) => `${f.employeeId}|${f.date}`));
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => failedKeys.has(k))));
      if (applied > 0) {
        toast.success(`Saved ${applied} change${applied === 1 ? '' : 's'}${pending ? ` -- ${pending} sent to HR for approval` : ''}`);
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} change${failed.length === 1 ? '' : 's'} could not be saved: ${failed[0].message}`);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleApprove(key: string, employeeId: string, date: string, note?: string) {
    closeCell(key);
    try {
      await approveAssignment.mutateAsync({ employeeId, date, note });
      toast.success('Duty approved');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      actions={
        <div className="flex items-center gap-2">
          <div className="shrink-0 sm:w-48">
            {isRestrictedAssigner ? (
              <div className="flex h-9 items-center rounded-md border border-line bg-surface-sunken px-3 text-sm text-text-muted">
                {employees[0]?.department?.name ?? 'Your department'}
              </div>
            ) : (
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">All Departments</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleRandomRoster}
            title="One click: random day off every week + a fair mix of shifts for everyone, from today. Review, then Save."
          >
            <Dices className="h-4 w-4" />
            Random Roster
          </Button>
          <Button variant="outline" onClick={() => openBulk([])}>
            <CalendarPlus className="h-4 w-4" />
            Assign Multiple
          </Button>
          <Button onClick={handleSave} disabled={draftCount === 0} loading={saveBatch.isPending}>
            <Save className="h-4 w-4" />
            Save{draftCount > 0 ? ` (${draftCount})` : ''}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <StatTile icon={Users} label="Team Size" value={employees.length} tone="default" />
        <StatTile icon={CalendarCheck} label="Shifts Assigned" value={shiftsAssigned} tone="success" />
        <StatTile icon={CalendarOff} label="Days Off" value={daysOff} tone="default" />
        <StatTile
          icon={Clock3}
          label="Pending Approval"
          value={pendingCount}
          tone={pendingCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{viewMode === 'month' ? 'This Month' : 'This Week'}</h3>
            <p className="text-xs text-text-secondary mt-0.5">{rangeLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-md border border-line p-0.5">
              {(['week', 'month'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium capitalize',
                    viewMode === m ? 'bg-accent-soft text-accent-dark' : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => step(-1)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <button
                onClick={() => step(1)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {draftCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-accent-soft px-5 py-2.5">
            <p className="text-xs font-medium text-accent-dark">
              {draftCount} unsaved change{draftCount === 1 ? '' : 's'} -- nothing is final until you press Save.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft({})} disabled={saveBatch.isPending}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} loading={saveBatch.isPending}>
                <Save className="h-3.5 w-3.5" />
                Save changes
              </Button>
            </div>
          </div>
        )}

        {openCell && <div className="fixed inset-0 z-20" onClick={() => closeCell(openCell)} />}

        <div className="overflow-x-auto">
          <div style={{ minWidth: gridMinWidth }}>
            <div className="grid border-t border-b border-line" style={{ gridTemplateColumns: gridCols }}>
              <div
                className={cn(
                  'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted bg-surface-sunken/60',
                  compact && 'sticky left-0 z-10 bg-surface-sunken',
                )}
              >
                Employee
              </div>
              {days.map((day, i) => {
                const isToday = isoDate(day) === todayIso;
                return (
                  <div
                    key={i}
                    className={cn(
                      compact ? 'px-0.5 py-2 text-center border-l border-line' : 'px-2 py-2.5 text-center border-l border-line',
                      isToday ? 'bg-accent-soft text-accent-dark' : 'text-text-secondary',
                    )}
                  >
                    <div className="text-[10px] font-semibold tracking-wide">{WEEKDAY_LABELS[(day.getDay() + 6) % 7]}</div>
                    <div className="mt-0.5 text-[13px] font-semibold">{day.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {!isLoading && employees.length === 0 && (
              <div className="py-16 text-center text-sm text-text-muted">
                No active employees{departmentId ? ' in this department' : ''}.
              </div>
            )}

            {employees.map((emp, rowIdx) => (
              <div key={emp.id} className="grid border-b border-line" style={{ gridTemplateColumns: gridCols }}>
                <div
                  className={cn(
                    'group flex items-center gap-2.5 px-4 py-2.5 min-w-0',
                    compact && 'sticky left-0 z-10 bg-white',
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold text-text-primary">
                    {initials(emp.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">{emp.fullName}</p>
                    <p className="text-[11px] text-text-muted truncate">{emp.designation?.title ?? emp.employeeCode}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center">
                    <button
                      onClick={() => handleRandomOff(emp)}
                      title="Random weekly day off -- one random day off in every week (click again to re-shuffle)"
                      aria-label={`Random weekly day off for ${emp.fullName}`}
                      className="rounded-md p-1 text-text-muted opacity-60 hover:bg-surface-sunken hover:text-accent-dark group-hover:opacity-100"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openBulk([emp.id])}
                      title={`Assign ${emp.fullName} for many days`}
                      aria-label={`Assign ${emp.fullName} for many days`}
                      className="rounded-md p-1 text-text-muted opacity-60 hover:bg-surface-sunken hover:text-accent-dark group-hover:opacity-100"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {days.map((day, i) => {
                  const dateIso = isoDate(day);
                  const key = `${emp.id}|${dateIso}`;
                  const saved = assignmentMap.get(key);
                  const dr = draft[key];
                  const isDraft = !!dr;
                  const draftCleared = dr?.action === 'CLEAR';
                  // A staged change overrides what's saved until Save.
                  const assignment: RosterAssignment | undefined = dr
                    ? draftCleared
                      ? undefined
                      : ({
                          id: `draft-${key}`,
                          employeeId: emp.id,
                          date: dateIso,
                          type: dr.type,
                          shiftId: dr.shiftId ?? null,
                          shift: dr.shiftId ? shiftById.get(dr.shiftId) : undefined,
                          status: 'APPROVED',
                          pendingRemoval: false,
                        } as unknown as RosterAssignment)
                    : saved;
                  const status = attendanceMap.get(key);
                  const alignRight = i >= days.length - (compact ? 4 : 2);
                  const openUp = employees.length > 4 && rowIdx >= employees.length - 2;
                  const colors = assignment
                    ? assignment.type === 'OFF'
                      ? OFF_COLORS
                      : shiftColors(assignment.shiftId ?? '')
                    : null;

                  const isPending = assignment?.status === 'PENDING';
                  const isPendingRemoval = assignment?.pendingRemoval ?? false;
                  // Only a date that's already passed is gated now --
                  // today and the future are freely editable by anyone,
                  // no reason or approval needed. A past date always
                  // needs a reason from whoever touches it; for
                  // Manager/Supervisor that reason files a request
                  // awaiting HR/Admin's approval (a content change goes
                  // PENDING, a clear sets isPendingRemoval instead -- see
                  // RosterService), while HR/Admin's own reason applies
                  // immediately either way.
                  const isBackdate = dateIso < todayIso;
                  const needsNote = isBackdate;
                  const noteDraft = noteDrafts[key] ?? '';

                  return (
                    <div key={i} className={cn('relative border-l border-line', compact ? 'p-0.5' : 'p-1.5')}>
                      {compact ? (
                        assignment ? (
                          <button
                            onClick={() => setOpenCell(openCell === key ? null : key)}
                            title={`${assignment.type === 'OFF' ? 'Day Off' : assignment.shift?.name ?? 'Shift'}${
                              assignment.type === 'SHIFT' && assignment.shift
                                ? ` (${assignment.shift.startTime}–${assignment.shift.endTime})`
                                : ''
                            }${isDraft ? ' -- unsaved' : isPendingRemoval ? ' -- removal pending' : isPending ? ' -- pending approval' : ''}`}
                            className={cn(
                              'relative flex h-11 w-full items-center justify-center rounded-md px-0.5 text-center hover:brightness-95',
                              colors!.bg,
                              isDraft && 'ring-2 ring-accent',
                            )}
                          >
                            <span className={cn('w-full truncate text-[10px] font-semibold', colors!.text)}>
                              {assignment.type === 'OFF' ? 'OFF' : assignment.shift?.name ?? 'Shift'}
                            </span>
                            {(isPending || isPendingRemoval) && (
                              <span
                                className={cn(
                                  'absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-full',
                                  isPendingRemoval ? 'bg-danger' : 'bg-warning',
                                )}
                              />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => setOpenCell(openCell === key ? null : key)}
                            title={draftCleared ? 'Will be cleared when you Save' : 'Assign'}
                            className={cn(
                              'flex h-11 w-full items-center justify-center rounded-md border border-dashed text-[13px] hover:border-accent hover:text-accent-dark',
                              draftCleared ? 'border-danger bg-danger-soft text-danger' : 'border-line text-text-muted',
                            )}
                          >
                            {draftCleared ? '×' : '+'}
                          </button>
                        )
                      ) : (
                        <>
                      {assignment ? (
                        <button
                          onClick={() => setOpenCell(openCell === key ? null : key)}
                          className={cn(
                            'w-full flex flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left hover:brightness-95',
                            colors!.bg,
                            isDraft && 'ring-2 ring-accent',
                          )}
                        >
                          <span className={cn('flex w-full items-center gap-1.5 text-[11px] font-semibold', colors!.text)}>
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', colors!.dot)} />
                            <span className="truncate">{assignment.type === 'OFF' ? 'Day Off' : assignment.shift?.name ?? 'Shift'}</span>
                            {isPendingRemoval && <Lock className="h-3 w-3 shrink-0 text-danger ml-auto" />}
                          </span>
                          {assignment.type === 'SHIFT' && assignment.shift && (
                            <span className="text-[10px] text-text-muted">
                              {assignment.shift.startTime}–{assignment.shift.endTime}
                            </span>
                          )}
                          {(isPending || isPendingRemoval) && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                                isPendingRemoval ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
                              )}
                            >
                              {isPendingRemoval ? <Lock className="h-2.5 w-2.5" /> : <Clock3 className="h-2.5 w-2.5" />}
                              {isPendingRemoval ? 'Removal Pending' : 'Pending'}
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => setOpenCell(openCell === key ? null : key)}
                          className={cn(
                            'w-full flex items-center justify-center rounded-lg border-2 border-dashed py-2.5 text-[11px] font-medium hover:border-accent hover:text-accent-dark',
                            draftCleared ? 'border-danger bg-danger-soft text-danger' : 'border-line text-text-muted',
                          )}
                        >
                          {draftCleared ? 'Will be cleared' : '+ Assign'}
                        </button>
                      )}

                        </>
                      )}

                      {status && (
                        <span
                          className={cn(
                            'absolute top-1 right-1 h-1.5 w-1.5 rounded-full ring-2 ring-white',
                            attendanceStatusColors[status]?.dot ?? 'bg-text-muted',
                          )}
                        />
                      )}

                      {openCell === key && (
                        <div
                          className={cn(
                            'absolute w-52 rounded-lg border border-line bg-white p-1.5 shadow-popover z-30',
                            openUp ? 'bottom-full mb-1' : 'top-full mt-1',
                            alignRight ? 'right-0' : 'left-0',
                          )}
                        >
                          {(isPending || isPendingRemoval) && isHrOrAdmin && (
                            <button
                              onClick={() => handleApprove(key, emp.id, dateIso, noteDraft.trim() || undefined)}
                              className={cn(
                                'w-full mb-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold hover:brightness-95',
                                isPendingRemoval ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success',
                              )}
                            >
                              {isPendingRemoval ? <Lock className="h-3.5 w-3.5" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                              {isPendingRemoval ? 'Confirm removal' : 'Approve as-is'}
                            </button>
                          )}

                          {isRestrictedAssigner && (isPending || isPendingRemoval) && (
                            <p className="mb-1.5 px-0.5 text-[10px] text-text-muted">
                              {isPendingRemoval ? 'Waiting on HR/Admin to confirm removal.' : 'Waiting on HR/Admin to approve.'}
                            </p>
                          )}

                          {needsNote && (
                            <div className="mb-1.5 px-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                Reason required (past date)
                              </p>
                              <Textarea
                                value={noteDraft}
                                onChange={(e) => setNoteDrafts((d) => ({ ...d, [key]: e.target.value }))}
                                placeholder="Why is this past date's roster changing?"
                                rows={2}
                                className="mt-1 text-xs"
                              />
                            </div>
                          )}

                          {(shifts ?? [])
                            .filter((s) => !s.departmentId || s.departmentId === emp.department?.id)
                            .map((s) => {
                            const c = shiftColors(s.id);
                            const disabled = needsNote && !noteDraft.trim();
                            return (
                              <button
                                key={s.id}
                                disabled={disabled}
                                onClick={() => handlePick(key, emp.id, dateIso, 'SHIFT', s.id, needsNote ? noteDraft.trim() : undefined)}
                                className={cn(
                                  'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left',
                                  disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-sunken',
                                )}
                              >
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c.dot)} />
                                <span className="min-w-0">
                                  <span className="block text-xs font-medium text-text-primary">{s.name}</span>
                                  <span className="block text-[10px] text-text-muted">
                                    {s.startTime}–{s.endTime}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                          <button
                            disabled={needsNote && !noteDraft.trim()}
                            onClick={() => handlePick(key, emp.id, dateIso, 'OFF', undefined, needsNote ? noteDraft.trim() : undefined)}
                            className={cn(
                              'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left',
                              needsNote && !noteDraft.trim() ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-sunken',
                            )}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                            <span className="text-xs font-medium text-text-primary">Day Off</span>
                          </button>
                          {assignment && (
                            <button
                              disabled={needsNote && !noteDraft.trim()}
                              onClick={() => handleClear(key, emp.id, dateIso, needsNote ? noteDraft.trim() : undefined)}
                              className={cn(
                                'w-full mt-1 border-t border-line pt-1.5 px-2 pb-0.5 text-left text-[11px] font-medium rounded-b-md',
                                needsNote && !noteDraft.trim()
                                  ? 'cursor-not-allowed text-text-muted opacity-60'
                                  : 'text-danger hover:bg-danger-soft',
                              )}
                            >
                              Clear assignment
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-line">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Shift</span>
          {(shifts ?? []).map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className={cn('h-1.5 w-1.5 rounded-full', shiftColors(s.id).dot)} />
              {s.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
            Day Off
          </span>
          <span className="h-3.5 w-px bg-line" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Attendance</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Present
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Late
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-danger" />
            Absent
          </span>
          <span className="h-3.5 w-px bg-line" />
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <Clock3 className="h-3 w-3 text-warning" />
            Pending HR approval
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <Lock className="h-3 w-3 text-danger" />
            Removal pending HR approval
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="h-3 w-3 rounded ring-2 ring-accent" />
            Unsaved (press Save)
          </span>
        </div>
      </Card>

      <BulkAssignModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        employees={employees}
        shifts={shifts ?? []}
        initialEmployeeIds={bulkEmployeeIds}
        rangeStart={startDate}
        rangeEnd={endDate}
        defaultStart={todayIso >= startDate && todayIso <= endDate ? todayIso : startDate}
        todayIso={todayIso}
        isHrOrAdmin={isHrOrAdmin}
        onApply={handleBulkApply}
        onAuto={handleAuto}
      />
    </ProgramWorkspace>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success' ? 'text-success bg-success-soft' : tone === 'warning' ? 'text-warning bg-warning-soft' : 'text-text-secondary bg-surface-sunken';
  return (
    <div className="flex items-center gap-3 rounded border border-line bg-white px-3.5 py-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded', toneClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted truncate">{label}</p>
        <span className="text-xl font-semibold text-text-primary leading-tight">{value}</span>
      </div>
    </div>
  );
}
