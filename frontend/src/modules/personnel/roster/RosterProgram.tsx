'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Users, CalendarCheck, CalendarOff, CalendarClock, type LucideIcon } from 'lucide-react';
import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { useDepartments } from '@/hooks/useDepartments';
import { useShifts } from '@/hooks/useShifts';
import { useRosterWeek, useUpsertRosterAssignment, useClearRosterAssignment } from '@/hooks/useRoster';
import { apiErrorMessage } from '@/lib/api';
import { attendanceStatusColors, cn, initials } from '@/lib/utils';
import type { RosterAssignment, RosterDayType } from '@/types';
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
 * The Roster program: a weekly calendar of every active employee's planned
 * shift, with real attendance status layered in for days that have already
 * happened. Distinct from Attendance (what actually happened) -- this is
 * what's *planned*, and clicking a cell assigns or clears that plan.
 */
export function RosterProgram({ tab }: { tab: WorkbenchTab }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [departmentId, setDepartmentId] = useState('');
  const [openCell, setOpenCell] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const startDate = isoDate(days[0]);
  const endDate = isoDate(days[6]);
  const todayIso = isoDate(new Date());

  const { data: departments } = useDepartments();
  const { data: shifts } = useShifts();
  const { data, isLoading } = useRosterWeek({ startDate, endDate, departmentId: departmentId || undefined });
  const upsertAssignment = useUpsertRosterAssignment();
  const clearAssignment = useClearRosterAssignment();

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

  const employees = data?.employees ?? [];
  const shiftsAssigned = (data?.assignments ?? []).filter((a) => a.type === 'SHIFT').length;
  const daysOff = (data?.assignments ?? []).filter((a) => a.type === 'OFF').length;
  const unassigned = employees.length * 7 - (data?.assignments?.length ?? 0);

  async function handlePick(employeeId: string, date: string, type: RosterDayType, shiftId?: string) {
    setOpenCell(null);
    try {
      await upsertAssignment.mutateAsync({ employeeId, date, type, shiftId });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleClear(employeeId: string, date: string) {
    setOpenCell(null);
    try {
      await clearAssignment.mutateAsync({ employeeId, date });
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
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <StatTile icon={Users} label="Team Size" value={employees.length} tone="default" />
        <StatTile icon={CalendarCheck} label="Shifts Assigned" value={shiftsAssigned} tone="success" />
        <StatTile icon={CalendarOff} label="Days Off" value={daysOff} tone="default" />
        <StatTile icon={CalendarClock} label="Unassigned" value={unassigned} tone={unassigned > 0 ? 'warning' : 'default'} />
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">This Week</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {shortDate(days[0])} – {shortDate(days[6])}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>
              This Week
            </Button>
            <button
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {openCell && <div className="fixed inset-0 z-20" onClick={() => setOpenCell(null)} />}

        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid border-t border-b border-line" style={{ gridTemplateColumns: '236px repeat(7, minmax(0, 1fr))' }}>
              <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted bg-surface-sunken/60">
                Employee
              </div>
              {days.map((day, i) => {
                const isToday = isoDate(day) === todayIso;
                return (
                  <div
                    key={i}
                    className={cn(
                      'px-2 py-2.5 text-center border-l border-line',
                      isToday ? 'bg-accent-soft text-accent-dark' : 'text-text-secondary',
                    )}
                  >
                    <div className="text-[10px] font-semibold tracking-wide">{WEEKDAY_LABELS[i]}</div>
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

            {employees.map((emp) => (
              <div
                key={emp.id}
                className="grid border-b border-line"
                style={{ gridTemplateColumns: '236px repeat(7, minmax(0, 1fr))' }}
              >
                <div className="flex items-center gap-2.5 px-4 py-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold text-text-primary">
                    {initials(emp.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">{emp.fullName}</p>
                    <p className="text-[11px] text-text-muted truncate">{emp.designation?.title ?? emp.employeeCode}</p>
                  </div>
                  {emp.subDepartment && (
                    <span className="ml-auto shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                      {emp.subDepartment.name}
                    </span>
                  )}
                </div>

                {days.map((day, i) => {
                  const dateIso = isoDate(day);
                  const key = `${emp.id}|${dateIso}`;
                  const assignment = assignmentMap.get(key);
                  const status = attendanceMap.get(key);
                  const alignRight = i >= 5;
                  const colors = assignment
                    ? assignment.type === 'OFF'
                      ? OFF_COLORS
                      : shiftColors(assignment.shiftId ?? '')
                    : null;

                  return (
                    <div key={i} className="relative border-l border-line p-1.5">
                      {assignment ? (
                        <button
                          onClick={() => setOpenCell(openCell === key ? null : key)}
                          className={cn(
                            'w-full flex flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left hover:brightness-95',
                            colors!.bg,
                          )}
                        >
                          <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold', colors!.text)}>
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', colors!.dot)} />
                            {assignment.type === 'OFF' ? 'Day Off' : assignment.shift?.name ?? 'Shift'}
                          </span>
                          {assignment.type === 'SHIFT' && assignment.shift && (
                            <span className="text-[10px] text-text-muted">
                              {assignment.shift.startTime}–{assignment.shift.endTime}
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => setOpenCell(openCell === key ? null : key)}
                          className="w-full flex items-center justify-center rounded-lg border-2 border-dashed border-line py-2.5 text-[11px] font-medium text-text-muted hover:border-accent hover:text-accent-dark"
                        >
                          + Assign
                        </button>
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
                            'absolute top-full mt-1 w-44 rounded-lg border border-line bg-white p-1.5 shadow-popover z-30',
                            alignRight ? 'right-0' : 'left-0',
                          )}
                        >
                          {(shifts ?? []).map((s) => {
                            const c = shiftColors(s.id);
                            return (
                              <button
                                key={s.id}
                                onClick={() => handlePick(emp.id, dateIso, 'SHIFT', s.id)}
                                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-sunken"
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
                            onClick={() => handlePick(emp.id, dateIso, 'OFF')}
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-sunken"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                            <span className="text-xs font-medium text-text-primary">Day Off</span>
                          </button>
                          {assignment && (
                            <button
                              onClick={() => handleClear(emp.id, dateIso)}
                              className="w-full mt-1 border-t border-line pt-1.5 px-2 pb-0.5 text-left text-[11px] font-medium text-danger hover:bg-danger-soft rounded-b-md"
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
        </div>
      </Card>
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
