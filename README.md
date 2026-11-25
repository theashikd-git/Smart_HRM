<div align="center">

# 🏥 Smart HRM

**Centralized Human Resource & Biometric Management System**

A full-stack HRM platform for a hospital: employees, departments, designations, shifts, rosters, leave, attendance (with configurable attendance policies), and a **ZKTeco uFace 800 Plus** biometric terminal, all from one web application.

`Next.js 14` · `NestJS` · `Prisma` · `PostgreSQL` · `Docker`

</div>

---

> Recent changes are logged in [`UPDATES.md`](UPDATES.md), newest first, with any commands you need to run after pulling.

> **This is a real, working codebase, not a mockup.** The only simulated piece is the biometric device itself (no physical ZKTeco hardware is reachable during development), so a mock client stands in behind the exact same interface a real device SDK would implement. Swap one file and it talks to real hardware.

## 📑 Contents

- [Stack](#-stack)
- [Roles & Portals](#-roles--portals)
- [Core Modules](#-core-modules)
- [How Organization, Roster & Policies Work](#-how-organization-roster--attendance-policies-work)
- [Quick Start (Docker)](#-quick-start-docker--recommended)
- [Quick Start (Manual)](#-quick-start-manual--local-development)
- [Project Structure](#-project-structure)
- [Connecting a Real ZKTeco Device](#-connecting-a-real-zkteco-device)
- [Core Workflow](#-core-workflow)
- [Known Limitations](#-known-limitations--next-steps)

---

## 🧰 Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, React Query, Zustand, Recharts |
| Backend  | NestJS, TypeScript, Prisma ORM, PostgreSQL, JWT auth, class-validator |
| Device   | Mock ZKTeco uFace 800 Plus client (drop-in replaceable with a real SDK) |
| Infra    | Docker Compose (Postgres + backend + frontend) |

---

## 👥 Roles & Portals

| Role | Access |
|------|--------|
| **ADMIN** | Full staff workbench, plus System Settings, user management, audit logs, device removal |
| **HR** | Full staff workbench: employees, departments, designations, shifts, devices, attendance, leave, reports |
| **DIRECTOR** (`MANAGING_DIRECTOR` in code) | Hospital-wide monitoring: the staff workbench with read access to reports, device details and attendance policies, minus System Settings (ADMIN-only). A dedicated Director dashboard is planned but not yet built |
| **MANAGER** | Own **Manager Portal** (`/manager-portal`): dashboard, My Leave, Leave on Behalf, and **Roster** for their own department |
| **SUPERVISOR** | Own **Supervisor Portal** (`/supervisor-portal`), currently identical to the Manager Portal (the schema documents a narrower, tier-based intent for a future release) |
| **EMPLOYEE** | Own **Employee Portal** (`/employee-portal`): self-service dashboard, My Leave, Leave Request |

**Sign-in:** ADMIN/HR use a username and password on the staff login form; every other role signs in with their **Employee ID**. Each role lands on its own home route automatically after login. There is no shared "workbench" landing page for Manager/Supervisor/Employee accounts.

> 🗓️ **Roster** is live for Manager and Supervisor: they assign duty only for employees in their own department. Any change to a date that has already passed needs a reason and waits for HR/Admin approval (see [Roster](#roster)). Shifts and policies are managed by ADMIN/HR only.

---

## 🧩 Core Modules

| Module | What it does |
|--------|--------------|
| **Employees** | Full CRUD and the source of truth for the whole system. Each employee has a leave category (Permanent / Provision / Contractual / Trial) that drives their leave entitlement. |
| **Departments & Designations** | **Designations are one shared, company-wide list.** Each department chooses which designations apply to it (many-to-many), and the employee form only offers the chosen department's active designations. |
| **Shifts** | Shift rules (hours, grace period, overtime), per department or general. A shift is **Fixed** (start/end time, grace and late apply) or **Flexible** (just a required number of hours a day, no grace or late). |
| **Roster** | Month or week calendar of planned duty for every active employee, with a sticky **Shift Summary** column (shift counts, days off, total duty, unassigned) and a **Coverage** card (head-count per shift for a chosen date). Includes Random Roster, Assign Multiple, and Save-to-confirm for every edit. |
| **Roster Approvals** | HR/Admin queue for Manager/Supervisor changes and clear requests on past dates: approve, or reject to restore what was there. |
| **Attendance Policies** | Organization > Policy: Grace-period and Late rules that turn repeated late/grace arrivals into policy absent days, versioned by effective date. |
| **Government Holidays** | Holiday calendar; attendance shows Holiday instead of Absent on those dates. |
| **Resigned Employees** | Mark an employee resigned or reinstate them from their profile. |
| **Department Superiors** | Who leads which department, resolved from both a department's designated head and any Supervisor configured as a fixed approver in that department's leave approval chain. |
| **Devices** | CRUD, connection control, and live sync against a ZKTeco biometric terminal ([details below](#-connecting-a-real-zkteco-device)). |
| **Attendance** | Punch ingestion from the device, manual punches, corrections, approvals, statuses (Present, Late, **Grace**, Absent, **Policy absent**, **Holiday duty**, **Short hours**, Leave), and a printable **Attendance Report**: a letterhead (company logo and name from Company Profile), a compact check-in/check-out table for the current filters, and totals, tuned to print cleanly on A4 without spilling across many pages. |
| **Leave Management** | A 7-type policy: Permanent, Provision (6-month probation), Contractual, Trial (custom duration set at hire), Compensatory (claimed against a specific overtime day), Maternity (2+ years tenure, up to 112 days, requires a document), and Unpaid. Balances, carry-forward rules, and anniversary-based resets are configured per employee category in **Leave Policy**; a daily scheduler handles rollovers and flags upcoming probation/trial deadlines. |
| **Dashboard** | Summary cards, charts, and (for Manager/Supervisor/HR/Admin) a live "Team on Leave" and team attendance view for the departments they lead. |
| **Reports** | Late, Absent, Overtime, Present, Early Out and Missing Punch reports, plus Monthly Attendance and Attendance Detail, with CSV export. Policy absent days appear in the Absent report and the Monthly summary. |
| **Audit Logs** | System-wide activity trail. |
| **System Settings** | ADMIN-only company profile: name, contact info, and a **company logo** used on the Attendance Report letterhead. |

---

## 🧭 How Organization, Roster & Attendance Policies work

### Designations and departments

Create designations once under **Organization > Designation** (names are unique, ignoring case and extra spaces). Then open **Organization > Department** and tick the designations that apply in each department. A designation held by employees can't be deleted (set it to Inactive instead); unlinking one from a department never changes people who already have it.

### Roster

- Today and future dates take effect immediately for anyone allowed to assign.
- A **past date** always needs a reason. HR/Admin changes apply right away; a Manager/Supervisor change goes **Pending** (amber dot) until HR/Admin approves it in **Roster Approvals**, and a request to clear a past duty is a **removal pending** (red lock) until approved.
- Nothing is saved as you click: edits are staged, highlighted, and only written when you press **Save** (or dropped with **Discard**).
- A Manager or Supervisor only ever sees and edits their own department's team.

### Attendance policies

- **Grace**: arriving after shift start but within the shift's grace minutes counts as present. After the grace minutes it is **Late**.
- **Rules**: per counting window, a number of free grace arrivals then every X extra = 1 absent day; every N late days = 1 absent day. Policies can cover everyone, or chosen departments, designations and employees (with an "Except" list); the most specific match wins.
- **Policy absent days** are separate records linked to the arrivals that caused them; the late or grace day keeps its own status.
- **Holiday duty**: a punch on a holiday or the employee's weekly off day. No grace or late rules apply.
- **Exemptions** (per employee, optional end date and reason) keep Grace/Late visible but never create policy absent days.
- Policy changes are never applied to the past by themselves. Changing a policy that has already counted arrivals starts a new version from the date you pick; use **Recalculate from date** on the Policy page to re-run earlier days (hand-corrected days are left alone).

---

## 🐳 Quick Start (Docker, recommended)

Requires Docker and Docker Compose.

```bash
docker compose up --build
```

This starts:

| Service    | URL |
|------------|-----|
| PostgreSQL | `localhost:5432` |
| Backend API | `http://localhost:4000/api` (Swagger docs at `/api/docs`) |
| Frontend   | `http://localhost:3000` |

On first run, the backend pushes the Prisma schema to the database automatically (`prisma db push`, fine for a fresh demo database). After the containers are up, **seed the demo data** (admin account, sample departments/shifts/employees):

```bash
docker compose exec backend npm run prisma:seed
```

Then open **http://localhost:3000** and sign in:

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@smarthrm.local   | Admin@123  |
| HR    | hr@smarthrm.local      | Hr@12345   |

> ⚠️ `db push` does not run the migration history, so it skips the hand-written SQL in some migrations (for example the case-insensitive unique index on designation names). For anything beyond a demo, run `npx prisma migrate deploy` against the database instead. Change the demo passwords and `JWT_SECRET` before real use.

---

## 🛠️ Quick Start (manual / local development)

### 1. Database

Install PostgreSQL locally, or run just the database via Docker:

```bash
docker run -d --name smart-hrm-postgres \
  -e POSTGRES_USER=hrm_user -e POSTGRES_PASSWORD=hrm_password -e POSTGRES_DB=smart_hrm \
  -p 5432:5432 postgres:16-alpine
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # adjust DATABASE_URL / JWT_SECRET if needed
npm install
npx prisma generate
npx prisma migrate dev               # applies every migration in prisma/migrations
npm run prisma:seed                  # optional demo data
npm run start:dev
```

Run the backend unit tests (attendance policy engine) with `npm test`.

The API runs on **http://localhost:4000/api** (Swagger UI at `/api/docs`).

> **Note:** `npx prisma generate` downloads Prisma's query engine binary from `binaries.prisma.sh`. If you're behind a restrictive firewall/proxy, make sure that domain is reachable. It is the only external dependency Prisma needs beyond the npm registry.

> **Upgrading an existing install:** after pulling, read the newest entries in [`UPDATES.md`](UPDATES.md), then from `backend` run `npm install`, `npx prisma migrate dev`, `npx prisma generate`, `npm run start:dev`. **On Windows, stop the running `start:dev` watcher first**, or `prisma generate` can't replace its files. If `migrate dev` offers to reset the database, answer **no**. Recent migrations add the 7-type leave policy, attendance policies and flexible shifts, roster approvals, and shared designations (which merges same-name designations without losing any). If a migration reports duplicate rows or employees missing a required field (e.g. `leaveCategory`), fix those in the data before re-running.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL defaults to http://localhost:4000/api
npm install
npm run dev
```

Open **http://localhost:3000**.

---

## 🗂️ Project Structure

```
smart-hrm/
├── backend/                       NestJS API
│   ├── prisma/
│   │   ├── schema.prisma          Full data model (users, employees, devices, leave, attendance, roster, policies...)
│   │   ├── migrations/            Migration history (some include hand-written SQL)
│   │   └── seed.ts                Demo data seeder
│   └── src/
│       ├── auth/                  JWT login (staff + Employee ID), guards, role-based access
│       ├── users/                 Admin-managed HR/Manager/Supervisor accounts
│       ├── company/               Single-row company profile (incl. logo)
│       ├── employees/             Core employee CRUD (source of truth)
│       ├── departments/           Department CRUD + which designations apply to each
│       ├── department-superiors/  Department leadership resolution
│       ├── designations/          Shared company-wide job titles
│       ├── shifts/                Shift definitions (hours, grace, overtime)
│       ├── roster/                Roster scheduling, pending approvals, removal requests
│       ├── policies/              Attendance policies + pure rule engine (with unit tests)
│       ├── holidays/              Government/company holidays
│       ├── devices/               Device CRUD + connection control + ZKTeco client
│       │   ├── zkteco/            ZktecoClient interface, mock + real implementations
│       │   └── device-sync.service.ts   Employee ⇄ device synchronization
│       ├── attendance/            Punch ingestion, processing, corrections, approvals
│       ├── leave/                 Leave requests, category policies, approval tiers, attachments
│       ├── dashboard/             Summary cards, chart data, team-on-leave / team-attendance
│       ├── reports/               Attendance reports + CSV export
│       ├── notifications/         In-app notifications
│       └── audit/                 System-wide audit logging
│
├── frontend/                      Next.js app
│   └── src/
│       ├── app/                   Routes: login, dashboard, employees, departments,
│       │                          designations, shifts, attendance, device, reports,
│       │                          leave, audit-logs, settings, and the role portals:
│       │                          hradmin-portal (Admin/HR/Director workbench),
│       │                          employee-portal, manager-portal, supervisor-portal
│       ├── components/            UI primitives + feature components
│       ├── modules/               Portal views (Employee/Manager Portal) and the Personnel
│       │   └── personnel/         workbench programs: employee, organization (department,
│       │                          designation, policy), roster, shift, attendance,
│       │                          holiday, leave-management, reports
│       ├── hooks/                 React Query hooks per resource
│       └── lib/                   API client, auth store (incl. per-role home routing), utilities
│
└── docker-compose.yml
```

---

## 🔌 Connecting a real ZKTeco device

All device communication goes through the `ZktecoClient` interface in `backend/src/devices/zkteco/zkteco-client.interface.ts`. Two implementations exist:

- **`ZktecoMockClient`** (default): simulates a device in memory. No hardware needed.
- **`ZktecoRealClient`**: talks to a real ZKTeco uFace 800 Plus (or any device in the same protocol family) over TCP, using the [`node-zklib`](https://www.npmjs.com/package/node-zklib) library plus a few raw protocol commands `node-zklib` doesn't wrap on its own.

Switching is controlled entirely by an environment variable, with **no code changes**:

```env
# backend/.env
ZKTECO_DRIVER="real"
```

### ✅ Before you flip the switch

1. **Make sure the device is reachable** from the machine running the backend: same LAN/VLAN, correct static IP, and the communication port open (default `4370`, configurable on the device under `Comm → Ethernet`).
2. **Add the device in the app** (Device page → Add Device) with its real IP and port, or edit the seeded device record directly.
3. **Test read-only operations first.** Click **Test Connection**, then **Device Info**, then try **Sync from Device** on the Attendance page (pulls punch logs; read-only and safe). This confirms connectivity before anything writes to the device.
4. **Test writes with one employee before bulk syncing.** Creating or editing a single employee pushes them to the device automatically. Confirm they appear correctly in the device's own user list (device menu → User Mgmt) before running **Bulk Sync All**.

### What's real vs. simplified in `ZktecoRealClient`

| Operation | Status |
|---|---|
| Connect / disconnect / test connection | ✅ Fully implemented via `node-zklib`, with an explicit connect timeout and retry-with-backoff (`node-zklib` itself never enforces a connect timeout; see code comments) |
| Pull attendance logs | ⚠️ Implemented via `node-zklib`. **Punch direction (IN/OUT) is inferred** by alternating per employee per day, since the library doesn't expose the device's in/out flag. Verify mode (fingerprint/face/RFID) is not exposed either and defaults to `FINGERPRINT`. Runs automatically every `ATTENDANCE_SYNC_INTERVAL_MS` in addition to the manual "Sync now" button. |
| Get device info (user count, storage) | ✅ Implemented via `node-zklib`. Fingerprint/face counts are **not** included (see last row). |
| Get serial number / firmware version | ✅ Raw protocol option query (`CMD_OPTIONS_RRQ`); well-documented and read-only |
| Sync device time | ✅ Raw `CMD_SET_TIME` / `CMD_GET_TIME`, encoding verified against `node-zklib`'s own time decoder |
| Restart device | ✅ Raw `CMD_RESTART` |
| Push/update employee (`setUser`) | ⚠️ Raw `CMD_USER_WRQ` with a 72-byte user record. The field layout was reverse-derived from `node-zklib`'s own `decodeUserData72()` decoder (not guessed), so reads and writes agree. **Not yet validated against physical hardware.** Test with one employee first. |
| Delete employee | ✅ Raw `CMD_DELETE_USER` |
| Clear fingerprint/face templates only | ⚠️ Raw `CMD_DELETE_USERTEMP`, looping finger slots 0–9. The payload layout matches the widely-referenced `pyzk` implementation, but like the other write operations **has not been validated against physical hardware**. Test on a spare device first. |
| Automatic reconnection | ✅ If a command fails in a way that looks like a dropped socket, the client reconnects once and retries. A background heartbeat (`DEVICE_HEARTBEAT_INTERVAL_MS`) also pings every configured device and flips `connectionStatus` back to `ONLINE` as soon as it's reachable again. |
| Concurrent access safety | ✅ Commands against the same device are serialized through an internal queue. The ZK protocol is a strict single request/response session, so a scheduled sync and a UI click can no longer corrupt each other's replies. |
| Fingerprint / face counts in Device Info | ❌ **Not implemented.** The device's `CMD_GET_FREE_SIZES` reply carries these on most firmwares, but at byte offsets this client couldn't verify against real hardware. Reporting a wrong number that *looks* authoritative seemed worse than reporting 0. If you have a device, capture a raw reply (`zk.executeCmd(11, '')` after a `getInfo()`; see `readOption`) and adjust `getInfo()` in `zkteco-real-client.ts` once you've confirmed the layout. |

If your device needs different behavior (e.g. it doesn't support the 72-byte user table, or exposes verify-mode/in-out-mode in a way you want decoded properly), `zkteco-real-client.ts` is a single, self-contained file. The rest of the app never needs to change, since everything talks to the `ZktecoClient` interface rather than this class directly.

### ⚙️ Tuning connection behavior

All of these live in `backend/.env` (see `.env.example` for defaults):

| Variable | Default | Purpose |
|---|---|---|
| `ZKTECO_CONNECT_TIMEOUT_MS` | `8000` | Max time to wait for the initial TCP connect |
| `ZKTECO_RESPONSE_TIMEOUT_MS` | `8000` | Max time to wait for a reply to any single command once connected |
| `ZKTECO_CONNECT_RETRIES` | `2` | Extra connect attempts (with backoff) before giving up |
| `ZKTECO_IDLE_TIMEOUT_MS` | `300000` | Release a pooled connection after this much inactivity (most ZKTeco terminals accept only one active session at a time) |
| `ATTENDANCE_SYNC_INTERVAL_MS` | `300000` | How often to auto-pull attendance in the background; `0` disables it |
| `DEVICE_HEARTBEAT_INTERVAL_MS` | `60000` | How often to ping devices to keep `connectionStatus` accurate; `0` disables it |

---

## 🔄 Core Workflow

```
Employee created in HRM (leave category assigned)
        │
        ▼
Assigned department / designation (from that department's list) / shift,
and duty planned in the Roster
        │
        ▼
Pushed to biometric device (automatic, async)
        │
        ▼
Employee punches in/out on device (fingerprint / face / RFID)
        │
        ▼
Attendance synced back into HRM ("Sync from Device")
        │
        ▼
Raw punches processed into daily AttendanceRecord
   (late minutes, overtime, work hours calculated from shift rules)
        │
        ▼
Attendance policies applied (grace/late arrivals can become policy absent days)
        │
        ▼
Dashboard, printable Attendance Report, and the attendance reports
```

**Leave runs in parallel:** an Employee/Manager/Supervisor submits a request from their portal (or HR logs one on an employee's behalf), it routes through that department's approval chain, and approved leave feeds back into attendance status and the "Team on Leave" dashboard view.

---

## 🚧 Known limitations / next steps

- **Attendance policy scopes** cover everyone, departments, designations and individual employees; employee groups are not built yet. Only two policy types exist (Grace-period and Late); the model can hold more.
- **Docker uses `prisma db push`**, which skips the migration history. Use `prisma migrate deploy` for real deployments (see the Docker note above).
- **Shifts are managed by ADMIN/HR only**; Manager/Supervisor use the Roster but can't create or edit shifts.
- **Supervisor is currently identical to Manager** in the portal UI. The data model already supports a narrower, tier-based permission set (see the `Role` enum in `schema.prisma`).
- **Director** has no dedicated dashboard yet and sees the same workbench as HR/Manager/Supervisor.
- **XLSX/PDF report export** is not yet implemented. CSV export is available for every report; the Attendance Report is print/PDF-via-browser only for now.
- **Real-time push sync** (device → server without polling) would require the ZKTeco Push SDK / webhook support instead of the current pull-based `POST /attendance/sync`.
- **Multi-device / multi-company** support is intentionally out of scope for v1. The schema and services are structured so both can be added later without a rewrite (`Device` and `Company` are already separate tables from `Employee`).
- **Employee document uploads** (resume, contract, certificates): the `Document` table and relations are ready, and leave attachments (for Maternity leave) are implemented, but a general-purpose upload endpoint is still open.
