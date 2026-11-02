# Smart HRM — Update Log

A running log of notable changes to the system. Newest entries at the top.
Add your own entries the same way: a dated heading, then a short bullet
list of what changed and why. If a change needs a follow-up step (a
migration, a config change, a manual check), call it out under **Action
needed** so it doesn't get missed.

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

- **Managing Director now has hospital-wide monitoring access.** The
  backend's role list was missing `MANAGING_DIRECTOR` entirely, so no
  `@Roles()`-guarded endpoint could ever grant it — even though the
  frontend already routed MD logins to the full workbench. Fixed, and
  granted read access to Reports and device detail/log endpoints
  specifically (mutating/admin endpoints were deliberately left
  untouched).
- **The dashboard now shows hospital-wide "Late Today" and "On Leave
  Today" lists directly**, rather than only to someone who happens to
  head a department — these are visible to anyone who opens the
  dashboard, including the Managing Director.
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
