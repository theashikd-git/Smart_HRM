import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AbsenceOutput,
  EmployeeCtx,
  PolicyDef,
  PolicyKind,
  PolicyParams,
  PolicyScopeInput,
  addDays,
  computeAbsences,
  counters,
  pickPolicy,
  windowOf,
} from './policy-engine';
import {
  ActivatePolicyDto,
  CreatePolicyDto,
  DeactivatePolicyDto,
  PolicyAbsenceQueryDto,
  UpdatePolicyDto,
} from './dto/policy.dto';

/** Calendar day of a DB date column, the same way the reports key them. */
export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
/** DB date value for a calendar day key. */
export const dateOf = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

function todayKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return dayKey(d);
}

type PolicyRow = Prisma.AttendancePolicyGetPayload<{ include: { scopes: true } }>;

const CACHE_MS = 10_000;

@Injectable()
export class PoliciesService {
  private cache: { at: number; defs: PolicyDef[] } | null = null;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ----------------------------------------------------------- helpers ----

  toDef(row: PolicyRow): PolicyDef {
    return {
      id: row.id,
      type: row.type as PolicyKind,
      params: row.params as unknown as PolicyParams,
      isActive: row.isActive,
      effectiveFrom: dayKey(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? dayKey(row.effectiveTo) : null,
      createdAt: row.createdAt.getTime(),
      scopes: row.scopes.map((s) => ({ kind: s.kind, targetType: s.targetType, targetId: s.targetId }) as PolicyScopeInput),
    };
  }

  private invalidate() {
    this.cache = null;
  }

  /** Every policy (all versions), cached for a few seconds so a device sync doesn't re-query per day. */
  async loadDefs(): Promise<PolicyDef[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.defs;
    const rows = await this.prisma.attendancePolicy.findMany({ include: { scopes: true } });
    const defs = rows.map((r) => this.toDef(r));
    this.cache = { at: Date.now(), defs };
    return defs;
  }

  employeeCtx(e: {
    id: string;
    departmentId: string | null;
    designationId: string | null;
    policyExempt: boolean;
    policyExemptUntil: Date | null;
  }): EmployeeCtx {
    return {
      id: e.id,
      departmentId: e.departmentId,
      designationId: e.designationId,
      policyExempt: e.policyExempt,
      policyExemptUntil: e.policyExemptUntil ? dayKey(e.policyExemptUntil) : null,
    };
  }

  private snapshot(row: PolicyRow) {
    return {
      name: row.name,
      description: row.description,
      type: row.type,
      params: row.params,
      isActive: row.isActive,
      effectiveFrom: dayKey(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? dayKey(row.effectiveTo) : null,
      scopes: row.scopes.map((s) => ({ kind: s.kind, targetType: s.targetType, targetId: s.targetId })),
    };
  }

  private async audit_(
    actorId: string | undefined,
    action: string,
    row: { id: string },
    oldValue: unknown,
    newValue: unknown,
    effectiveFrom?: string | null,
  ) {
    await this.audit.log({
      userId: actorId,
      action,
      entity: 'AttendancePolicy',
      entityId: row.id,
      details: JSON.stringify({ old: oldValue, new: newValue, effectiveFrom: effectiveFrom ?? null, actor: actorId ?? null }),
    });
  }

  private validateParams(type: PolicyKind, p: PolicyParams) {
    if (type === 'LATE' && p.allowed !== 0) {
      throw new BadRequestException('A late-arrival policy has no free arrivals: set "allowed" to 0.');
    }
    if (!p.resetEnabled && p.resetAfterDays) {
      throw new BadRequestException('Turn the counter reset on to set a reset interval.');
    }
  }

  private cleanParams(p: PolicyParams): PolicyParams {
    return {
      windowUnit: p.windowUnit,
      windowSize: p.windowSize,
      allowed: p.allowed,
      convertEvery: p.convertEvery,
      resetEnabled: p.resetEnabled,
      resetAfterDays: p.resetEnabled ? (p.resetAfterDays ?? null) : null,
    };
  }

  private async validateScopes(scopes: PolicyScopeInput[]) {
    const ids = (t: string) => [...new Set(scopes.filter((s) => s.targetType === t).map((s) => s.targetId))];
    const checks: [string, string[], () => Promise<number>][] = [
      ['department', ids('DEPARTMENT'), async () => this.prisma.department.count({ where: { id: { in: ids('DEPARTMENT') } } })],
      ['designation', ids('DESIGNATION'), async () => this.prisma.designation.count({ where: { id: { in: ids('DESIGNATION') } } })],
      ['employee', ids('EMPLOYEE'), async () => this.prisma.employee.count({ where: { id: { in: ids('EMPLOYEE') } } })],
    ];
    for (const [label, list, count] of checks) {
      if (list.length && (await count()) !== list.length) throw new BadRequestException(`One or more selected ${label}s no longer exist.`);
    }
  }

  private sameJson(a: unknown, b: unknown) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private scopeKey(s: PolicyScopeInput) {
    return `${s.kind}|${s.targetType}|${s.targetId}`;
  }

  // -------------------------------------------------------------- CRUD ----

  list() {
    return this.prisma.attendancePolicy.findMany({
      include: { scopes: true },
      orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.attendancePolicy.findUnique({ where: { id }, include: { scopes: true } });
    if (!row) throw new NotFoundException('Policy not found');
    return row;
  }

  async create(dto: CreatePolicyDto, actorId?: string) {
    const params = this.cleanParams(dto.params as PolicyParams);
    this.validateParams(dto.type, params);
    const scopes = dto.scopes ?? [];
    await this.validateScopes(scopes);
    const effectiveFrom = dto.effectiveFrom ? dto.effectiveFrom.slice(0, 10) : todayKey();

    const row = await this.prisma.attendancePolicy.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        params: params as unknown as Prisma.InputJsonValue,
        effectiveFrom: dateOf(effectiveFrom),
        isActive: true,
        createdById: actorId,
        scopes: { create: scopes.map((s) => ({ kind: s.kind, targetType: s.targetType, targetId: s.targetId })) },
      },
      include: { scopes: true },
    });
    this.invalidate();
    await this.audit_(actorId, 'POLICY_CREATED', row, null, this.snapshot(row), effectiveFrom);
    return row;
  }

  private async hasHistory(policyId: string) {
    const [o, a] = await Promise.all([
      this.prisma.policyOccurrence.count({ where: { policyId } }),
      this.prisma.policyAbsence.count({ where: { policyId } }),
    ]);
    return o + a > 0;
  }

  async update(id: string, dto: UpdatePolicyDto, actorId?: string) {
    const cur = await this.findOne(id);
    const before = this.snapshot(cur);

    const nextParams = dto.params ? this.cleanParams(dto.params as PolicyParams) : (cur.params as unknown as PolicyParams);
    const nextScopes = dto.scopes ?? cur.scopes.map((s) => ({ kind: s.kind, targetType: s.targetType, targetId: s.targetId }));
    this.validateParams(cur.type as PolicyKind, nextParams);
    if (dto.scopes) await this.validateScopes(dto.scopes);

    const paramsChanged = !!dto.params && !this.sameJson(this.cleanParams(cur.params as unknown as PolicyParams), nextParams);
    const scopesChanged =
      !!dto.scopes &&
      !this.sameJson(
        cur.scopes.map((s) => this.scopeKey(s as PolicyScopeInput)).sort(),
        nextScopes.map((s) => this.scopeKey(s)).sort(),
      );
    const name = dto.name?.trim() || cur.name;
    const description = dto.description !== undefined ? dto.description.trim() || null : cur.description;

    // Name / description only: edit in place, history is untouched.
    if (!paramsChanged && !scopesChanged) {
      const row = await this.prisma.attendancePolicy.update({
        where: { id },
        data: { name, description },
        include: { scopes: true },
      });
      this.invalidate();
      await this.audit_(actorId, 'POLICY_UPDATED', row, before, this.snapshot(row), dayKey(row.effectiveFrom));
      return row;
    }

    if (!cur.isActive || cur.effectiveTo) {
      throw new BadRequestException('This policy is not active. Activate it first, then change its rules.');
    }

    const from = dto.effectiveFrom ? dto.effectiveFrom.slice(0, 10) : todayKey();
    const history = await this.hasHistory(id);

    // Never used yet: safe to change in place.
    if (!history) {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.attendancePolicyScope.deleteMany({ where: { policyId: id } });
        return tx.attendancePolicy.update({
          where: { id },
          data: {
            name,
            description,
            params: nextParams as unknown as Prisma.InputJsonValue,
            effectiveFrom: dto.effectiveFrom ? dateOf(from) : undefined,
            scopes: { create: nextScopes.map((s) => ({ kind: s.kind, targetType: s.targetType, targetId: s.targetId })) },
          },
          include: { scopes: true },
        });
      });
      this.invalidate();
      await this.audit_(actorId, 'POLICY_UPDATED', row, before, this.snapshot(row), dayKey(row.effectiveFrom));
      return row;
    }

    // Already counted arrivals under the old rules: close that version and
    // start a new one, so earlier periods keep the rules they were counted with.
    if (from <= dayKey(cur.effectiveFrom)) {
      throw new BadRequestException(
        `The new rules must start after this version's start date (${dayKey(cur.effectiveFrom)}), because arrivals have already been counted under it.`,
      );
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.attendancePolicy.update({
        where: { id },
        data: { isActive: false, effectiveTo: dateOf(addDays(from, -1)) },
      });
      return tx.attendancePolicy.create({
        data: {
          name,
          description,
          type: cur.type,
          params: nextParams as unknown as Prisma.InputJsonValue,
          effectiveFrom: dateOf(from),
          isActive: true,
          createdById: actorId,
          scopes: { create: nextScopes.map((s) => ({ kind: s.kind, targetType: s.targetType, targetId: s.targetId })) },
        },
        include: { scopes: true },
      });
    });
    this.invalidate();
    await this.audit_(actorId, 'POLICY_UPDATED', row, before, { ...this.snapshot(row), previousVersionId: id }, from);
    return row;
  }

  async deactivate(id: string, dto: DeactivatePolicyDto, actorId?: string) {
    const cur = await this.findOne(id);
    if (!cur.isActive || cur.effectiveTo) throw new BadRequestException('This policy is already inactive.');
    const to = dto.effectiveTo ? dto.effectiveTo.slice(0, 10) : todayKey();
    if (to < dayKey(cur.effectiveFrom)) throw new BadRequestException('The end date cannot be before the policy starts.');
    const before = this.snapshot(cur);
    const row = await this.prisma.attendancePolicy.update({
      where: { id },
      data: { isActive: false, effectiveTo: dateOf(to) },
      include: { scopes: true },
    });
    this.invalidate();
    await this.audit_(actorId, 'POLICY_DEACTIVATED', row, before, this.snapshot(row), to);
    return row;
  }

  async activate(id: string, dto: ActivatePolicyDto, actorId?: string) {
    const cur = await this.findOne(id);
    if (cur.isActive && !cur.effectiveTo) throw new BadRequestException('This policy is already active.');
    const before = this.snapshot(cur);
    const from = dto.effectiveFrom ? dto.effectiveFrom.slice(0, 10) : todayKey();

    if (!(await this.hasHistory(id))) {
      const row = await this.prisma.attendancePolicy.update({
        where: { id },
        data: { isActive: true, effectiveTo: null, effectiveFrom: dto.effectiveFrom ? dateOf(from) : undefined },
        include: { scopes: true },
      });
      this.invalidate();
      await this.audit_(actorId, 'POLICY_ACTIVATED', row, before, this.snapshot(row), dayKey(row.effectiveFrom));
      return row;
    }

    // Its earlier days stay exactly as they were: reactivating starts a new version.
    if (cur.effectiveTo && from <= dayKey(cur.effectiveTo)) {
      throw new BadRequestException(`Choose a start date after ${dayKey(cur.effectiveTo)}, when this policy ended.`);
    }
    const row = await this.prisma.attendancePolicy.create({
      data: {
        name: cur.name,
        description: cur.description,
        type: cur.type,
        params: cur.params as Prisma.InputJsonValue,
        effectiveFrom: dateOf(from),
        isActive: true,
        createdById: actorId,
        scopes: { create: cur.scopes.map((s) => ({ kind: s.kind, targetType: s.targetType, targetId: s.targetId })) },
      },
      include: { scopes: true },
    });
    this.invalidate();
    await this.audit_(actorId, 'POLICY_ACTIVATED', row, before, { ...this.snapshot(row), previousVersionId: id }, from);
    return row;
  }

  // ------------------------------------------------- occurrences / absences

  /**
   * Makes the stored arrival for this employee and day match what the daily
   * calculation found (`occ`, or null = nothing to track), then rebuilds the
   * affected policy absent days. Safe to call any number of times.
   */
  async syncDay(
    employeeId: string,
    key: string,
    occ: { type: PolicyKind; policyId: string; counted: boolean } | null,
  ) {
    const date = dateOf(key);
    const existing = await this.prisma.policyOccurrence.findMany({ where: { employeeId, date } });
    const affected = new Set<string>();
    let keep: (typeof existing)[number] | null = null;

    for (const e of existing) {
      if (occ && e.policyId === occ.policyId && e.type === occ.type && !keep) {
        keep = e;
      } else {
        await this.prisma.policyOccurrence.delete({ where: { id: e.id } });
        affected.add(e.policyId);
      }
    }

    if (occ) {
      if (keep) {
        if (keep.counted !== occ.counted) {
          await this.prisma.policyOccurrence.update({ where: { id: keep.id }, data: { counted: occ.counted } });
          affected.add(occ.policyId);
        }
      } else {
        const def = (await this.loadDefs()).find((d) => d.id === occ.policyId);
        if (def) {
          const w = windowOf(def.params, def.effectiveFrom, key);
          try {
            await this.prisma.policyOccurrence.create({
              data: {
                employeeId,
                policyId: occ.policyId,
                type: occ.type,
                date,
                windowKey: w.key,
                windowStart: dateOf(w.start),
                windowEnd: dateOf(w.end),
                counted: occ.counted,
              },
            });
          } catch (err: any) {
            if (err?.code !== 'P2002') throw err; // another sync stored it first
          }
          affected.add(occ.policyId);
        }
      }
    }

    for (const policyId of affected) await this.rebuildAbsences(employeeId, policyId);
  }

  private absenceKey(date: string, ids: string[]) {
    return `${date}|${[...ids].sort().join(',')}`;
  }

  private reasonFor(def: PolicyDef) {
    return def.type === 'GRACE' ? 'Policy absent (grace)' : `Policy absent (${def.params.convertEvery} late)`;
  }

  /** Recomputes one employee's policy absent days for one policy from the stored arrivals. */
  async rebuildAbsences(employeeId: string, policyId: string) {
    const row = await this.prisma.attendancePolicy.findUnique({ where: { id: policyId }, include: { scopes: true } });
    if (!row) return;
    const def = this.toDef(row);

    const occs = await this.prisma.policyOccurrence.findMany({ where: { employeeId, policyId }, orderBy: { date: 'asc' } });
    const desired: AbsenceOutput[] = computeAbsences(
      def.params,
      def.effectiveFrom,
      occs.map((o) => ({ id: o.id, date: dayKey(o.date), counted: o.counted })),
    );
    const existing = await this.prisma.policyAbsence.findMany({
      where: { employeeId, policyId },
      include: { occurrences: { select: { id: true } } },
    });

    const wanted = new Map(desired.map((d) => [this.absenceKey(d.date, d.occurrenceIds), d]));
    const have = new Map(existing.map((e) => [this.absenceKey(dayKey(e.date), e.occurrences.map((o) => o.id)), e]));

    for (const [k, e] of have) {
      if (!wanted.has(k)) await this.prisma.policyAbsence.delete({ where: { id: e.id } });
    }
    for (const [k, d] of wanted) {
      if (have.has(k)) continue;
      try {
        await this.prisma.policyAbsence.create({
          data: {
            employeeId,
            policyId,
            type: def.type,
            date: dateOf(d.date),
            windowKey: d.windowKey,
            reason: this.reasonFor(def),
            occurrences: { connect: d.occurrenceIds.map((id) => ({ id })) },
          },
        });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    }
  }

  /** The employee's counters under each policy that applies to them today. */
  async countersFor(employeeId: string, asOf?: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, departmentId: true, designationId: true, policyExempt: true, policyExemptUntil: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    const ctx = this.employeeCtx(emp);
    const day = asOf ? asOf.slice(0, 10) : todayKey();
    const defs = await this.loadDefs();

    const out: any[] = [];
    for (const type of ['GRACE', 'LATE'] as PolicyKind[]) {
      const def = pickPolicy(defs, ctx, type, day);
      if (!def) continue;
      const occs = await this.prisma.policyOccurrence.findMany({ where: { employeeId, policyId: def.id } });
      const c = counters(
        def.params,
        def.effectiveFrom,
        occs.map((o) => ({ id: o.id, date: dayKey(o.date), counted: o.counted })),
        day,
      );
      const meta = await this.prisma.attendancePolicy.findUnique({ where: { id: def.id }, select: { name: true } });
      out.push({ policyId: def.id, name: meta?.name ?? '', type, params: def.params, ...c });
    }
    return {
      employeeId,
      asOf: day,
      exempt: ctx.policyExempt && (!ctx.policyExemptUntil || day <= ctx.policyExemptUntil),
      counters: out,
    };
  }

  /** Policy absent days, each with the arrivals that caused it, for reports and an employee's own view. */
  async listAbsences(q: PolicyAbsenceQueryDto) {
    const where: Prisma.PolicyAbsenceWhereInput = {};
    if (q.employeeId) where.employeeId = q.employeeId;
    if (q.departmentId) where.employee = { departmentId: q.departmentId };
    if (q.startDate || q.endDate) {
      where.date = {
        gte: q.startDate ? dateOf(q.startDate.slice(0, 10)) : undefined,
        lte: q.endDate ? dateOf(q.endDate.slice(0, 10)) : undefined,
      };
    }
    const rows = await this.prisma.policyAbsence.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true, department: { select: { name: true } } } },
        policy: { select: { name: true } },
        occurrences: { select: { date: true, type: true }, orderBy: { date: 'asc' } },
      },
      orderBy: [{ date: 'desc' }],
      take: 5000,
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      employeeId: r.employeeId,
      employeeName: r.employee.fullName,
      employeeCode: r.employee.employeeCode,
      department: r.employee.department?.name ?? null,
      policyId: r.policyId,
      policyName: r.policy.name,
      type: r.type,
      label: r.reason,
      occurrenceDates: r.occurrences.map((o) => dayKey(o.date)),
    }));
  }

  async auditRecalculation(actorId: string | undefined, details: Record<string, unknown>) {
    await this.audit.log({
      userId: actorId,
      action: 'POLICY_RECALCULATED',
      entity: 'AttendancePolicy',
      details: JSON.stringify({ ...details, actor: actorId ?? null }),
    });
  }
}
