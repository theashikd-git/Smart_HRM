# Smart HRM — Update Log

A running log of notable changes to the system. Newest entries at the top.
Add your own entries the same way: a dated heading, then a short bullet
list of what changed and why. If a change needs a follow-up step (a
migration, a config change, a manual check), call it out under **Action
needed** so it doesn't get missed.

---

## 2026-11-27 — Device attendance sync: wrong check-in / check-out fixed

- **The problem.** The real ZKTeco client can't read the device's IN/OUT
  flag, so it guessed by alternating IN, OUT, IN, OUT over each employee's
  whole punch history. One missed or doubled punch flipped the guess for
  every later day, and the daily record (which trusted that guess) could
  show check-in and check-out swapped, a check-in at the end of the day,
  negative work hours, or a wrong Late status.
- **The fix.** A day's **check-in is now the earliest punch and the
  check-out the latest punch** of that day. The guessed flag is no longer
  used. Two punches less than a minute apart count as one (a double swipe),
  so a lone double swipe shows as a missing check-out instead of 0 hours. A
  manual punch added by HR is treated as any other punch.
- **Large device logs.** Pulling a very large punch history (tens of
  thousands of records) no longer risks a "Maximum call stack size exceeded"
  error.
- **Unlinked device users.** Punches from a device user ID that no employee
  has as "Device User ID" are still skipped, but the backend log now lists
  those IDs so a missing or mistyped Device User ID is easy to find.
- Existing records are not changed automatically. To fix days already
  calculated wrongly, run **Recalculate from date** on Organization > Policy
  from the date the problem began (days HR corrected by hand are left
  alone).
- Tests added for the new check-in/check-out rule (`npm test`).

**Action needed:** restart the backend (`npm run start:dev`), then run
Recalculate from date once for the affected period. No database change.

---

## 2026-11-24 — Roster Approvals: no more "Only a pending duty can be approved"

- Approving a duty that was already approved (approved from another tab or
  the Roster grid, or the list was a few seconds old) used to fail with
  *"Only a pending duty can be approved (current status: APPROVED)"*. It now
  just succeeds quietly, because the duty is already approved. Nothing is
  audited or sent to the employee a second time.
- The Roster Approvals list now refreshes after every approve/reject, even a
  failed one, so a stale row disappears on its own. The error message also
  names the employee and date that failed.
- Approve and Reject now act on the exact roster row (by its id, sent from
  the Approvals list and the Roster grid) instead of matching on employee +
  date, so a decision can't land on a neighbouring day. Older callers that
  send only employee + date still work.

**Action needed:** restart the backend (`npm run start:dev`) and refresh the
browser.

---

## 2026-11-24 — Roster: Shift Summary column and Coverage card

- **Shift Summary** (new sticky column at the right end of the Roster grid,
  Week and Month view). Per employee, for the period on screen: a coloured
  badge with the count for every shift they have, **OFF** shown separately
  (not counted as duty), **Duty** (the sum of the shift counts) and
  **Unassigned** (empty days, in muted text). A small amber dot marks shifts
  that include pending-approval days. Hover for the full breakdown with each
  shift's time range (flexible shifts show their required hours).
- **Today's Coverage** (new 5th card in the stat row, wraps on small
  screens). Shows how many people are on each shift, OFF and unassigned for
  one date. Click any date header to see that date ("Coverage: 15 Nov"); the
  column is highlighted and a **Today** link resets it. A shift with nobody
  on it is shown in red. If today isn't in the month on screen, the card
  shows the first day of that period until a date is clicked.
- Shift types come from the Shift table, so new shifts appear on their own.
  Numbers include unsaved edits straight away and follow the month/week and
  department filter. The other four stat cards are unchanged (still saved
  data only).
- Frontend only: no API, database or dependency changes. The calculations
  are small pure functions in `roster-summary.ts`.

**Action needed:** none. Refresh the page.

---

## 2026-11-23 — Designations are now one shared list

- **Designations no longer belong to a department.** Organization >
  Designation is a single company-wide list: name, status, employee count
  and the departments each one is linked to. The Add/Edit form has just the
  title and status. Names must be unique, ignoring case and extra spaces
  ("staff nurse" and "Staff Nurse" are the same).
- **Departments choose their designations.** In Organization > Department,
  Add/Edit has a searchable "Applicable designations" box with Select all
  and Clear. The department list shows how many each has.
- **Employee form.** The designation dropdown lists only the chosen
  department's active designations and resets when the department changes.
  When editing, the employee's current designation is still shown even if
  it was unlinked later. The server checks the same rule, but only when an
  employee gets a new designation, so unlinking never breaks existing people.
- **Deleting.** A designation held by employees can't be deleted; set it to
  Inactive instead. Unlinking a designation from a department is always
  allowed and leaves existing employees untouched.
- **API.** `GET /departments/:id/designations` (active only). Department
  create/update accept `designationIds`; designation create/update no
  longer take `departmentId`. Changes are written to the audit log with
  old and new values.
- **Migration** (`20261123000000_designations_shared_across_departments`)
  loses nothing: same-name designations (trimmed, case-insensitive) are
  merged into the oldest one, with employees and attendance policy scopes
  repointed to it (it stays Active if any copy was). Every old
  (department, designation) pair becomes a link, plus each employee's own
  pair. **Designations that had no department are not linked to anything**,
  so they stay unlinked until you add them to a department. To list them:
  `SELECT title FROM designations d WHERE NOT EXISTS (SELECT 1 FROM department_designations x WHERE x."designationId" = d.id);`

**Action needed** (from the `backend` folder). On Windows, stop the
`npm run start:dev` watcher first, or `prisma generate` can't replace its
files:

```
npm install
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

If `migrate dev` offers to reset the database, answer **no** and tell me.
Then link designations to departments under Organization > Department
(only the unlinked ones need it).

---

## 2026-11-22 — Attendance policies (Organization > Policy)

- **New: Organization > Policy**, directly under Company. Admin and HR can
  create, edit, activate and deactivate attendance policies; the Director
  can view them. Two policy types for now (Grace-period arrivals and Late
  arrivals); the model stores each policy's settings, so more types can be
  added later without a new table.
- **New status Grace** ("Grace-period attendance"): arriving after the
  shift start but within the shift's own grace minutes. It counts as
  present. Arriving after the grace minutes is still **Late**, as before.
- **Grace rule.** Per counting window (N days / weeks / calendar months):
  a number of free grace arrivals, then every X extra = 1 absent day.
  Counters can reset at the end of each window or every N days, or never.
  Example: 7-day window, 3 allowed, every 3 extra = 1 absent day, reset
  every 7 days: the 4th to 6th grace arrivals in a week make 1 absent day.
- **Late rule.** Every N late days (default 3) = 1 absent day, counted per
  window (default calendar month). Leftovers carry over until the reset.
- **Policy absent days** are kept as their own records, dated the day the
  last arrival of the group happened, and linked to the arrivals that
  caused them. The late or grace day itself keeps its status. They show in
  the Absent report, the Monthly Attendance summary (own "Policy Absent"
  column), the Attendance screen and the Attendance Report/PDF, labelled
  "Policy absent (3 late)" or "Policy absent (grace)".
- **Holiday duty.** A punch on a government/company holiday or on the
  employee's weekly off day (rostered day off, or the shift's weekend) is
  now **Holiday duty** (before: Holiday). No grace or late rules apply, and
  it counts as present in the dashboard and reports.
- **Who a policy covers.** Everyone, or chosen departments, designations
  and individual employees, plus an "Except" list. When several match, the
  most specific wins (employee, designation, department, everyone).
  Employee groups are not built yet.
- **Exemptions.** The Employee form (Attendance Settings) has "Attendance
  policy exempt", an optional "until" date and a reason. An exempt
  employee still shows Grace/Late, but never gets policy absent days.
- **Flexible shifts.** Shift type Fixed (default) or Flexible with required
  hours a day. A flexible shift never shows Grace or Late; fewer hours than
  required shows as **Short hours**, with no penalty.
- **Changes are never applied to the past by themselves.** Each policy has
  an effective date. Changing the rules or scope of a policy that has
  already counted arrivals starts a new version from the date you pick;
  the old version keeps its earlier days. Reactivating an ended policy
  also starts a new version. There is no automatic backfill: to re-run
  past days, use **Recalculate from date** on the Policy page (days HR
  corrected by hand are left alone). Re-syncing the device or recalculating
  never counts a day twice.
- **Audit log.** Policy created / updated / activated / deactivated,
  employee exemption changes, shift type changes and recalculations are
  logged with old and new values, the effective date and who did it.
- **Action needed:** in `backend`, run `npm install` (adds Jest for the new
  tests, `npm test`), then stop the backend and run `npx prisma migrate dev`
  (migration `20261122000000_add_attendance_policies`, additive only:
  existing shifts become Fixed, no data is changed) and `npx prisma generate`,
  then restart. Nothing is backfilled. Create your first policy, then use
  Recalculate from date only if you want it applied to earlier days.

---

## 2026-11-02 — Leave approval notes, HR-initiated cancellation, text cleanup

- **Approve/Reject notes.** Approving a leave request now opens a small
  dialog with an optional note — never required. Rejecting a request
  already required a reason; that's unchanged. Both show up next to the
  request's status wherever it's displayed (My Leave, Leave Request,
  Leave on Behalf, the Leave module).
- **HR/Admin/Manager can now cancel a leave request at any time** —
  pending, already approved, or already rejected (only an
  already-cancelled request can't be cancelled again). This is a direct,
  one-step override, separate from the employee's own
  request-cancellation flow (which still needs its own approval chain).
  - A reason is **required** when cancelling a request that's currently
    **approved** — it was already granted (calendar, balance, attendance
    all get reversed), so cancelling it needs an explanation.
  - A reason is optional when cancelling a pending or already-rejected
    request.
  - The employee is always notified, and the cancellation (with reason,
    if given) shows up on their own leave screens.
- **Removed the "—" (em dash) character** from every user-facing string
  and developer comment across the frontend (43 files), replacing it with
  whatever reads naturally in context — "to" for date ranges, "·" to
  match the app's existing separator style, ": " for label/value pairs,
  "--" in code comments, or nothing at all for placeholder text.
- **Action needed:** run `npx prisma migrate dev` to apply two new
  columns — `LeaveRequest.approvalNote` and `LeaveRequest.cancelledReason`
  — before the backend will build/run with this update.

## 2026-10-31 — Dashboard visibility, role access, portal UX

- **Director now has hospital-wide monitoring access.** The
  backend's role list was missing `MANAGING_DIRECTOR` entirely, so no
  `@Roles()`-guarded endpoint could ever grant it — even though the
  frontend already routed MD logins to the full workbench. Fixed, and
  granted read access to Reports and device detail/log endpoints
  specifically (mutating/admin endpoints were deliberately left
  untouched).
- **The dashboard now shows hospital-wide "Late Today" and "On Leave
  Today" lists directly**, rather than only to someone who happens to
  head a department — these are visible to anyone who opens the
  dashboard, including the Director.
- **Manager/Supervisor tier rules added:** a Supervisor can't see a
  Manager's check-in/out time or pick a Manager for Leave on Behalf; a
  Manager can see/pick a Supervisor. Leave-on-behalf is now
  backend-enforced to the actor's own department — this closed a real
  gap where any Manager/Supervisor could previously file leave on behalf
  of an employee in *any* department via a direct API call, bypassing
  the UI's own restriction entirely.
- **Change Password** added to the account menu (My Profile / Change
  Password / Sign Out) — available on every portal via one shared
  component.
- **Top bar cleanup:** removed the non-functional grid/launcher icon;
  the search icon is now a real, working search across every module.
- **Government Holiday feature:** full CRUD for holidays, with
  attendance showing HOLIDAY instead of ABSENT on a holiday date, and
  the dashboard falling back the same way.

### Other changes same day (see git log for detail)
- Resigned Employees made real — mark/reinstate from the Employee profile.
- Edit button added to the Employee profile screen itself, not just the list row.
- Superior Management removed from the Leave Management menu.
- A TypeScript build error in attendance sync fixed (explicit `string[]` typing).

---

*Add new entries above this line, newest first.*
