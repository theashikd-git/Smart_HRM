<div align="center">

# 🏥 Smart HRM

**Centralized Human Resource & Biometric Management System**

A full-stack HRM platform for a hospital: employees, departments, shifts, leave, attendance, and a **ZKTeco uFace 800 Plus** biometric terminal, all from one web application.

`Next.js 14` · `NestJS` · `Prisma` · `PostgreSQL` · `Docker`

</div>

---

> **This is a real, working codebase, not a mockup.** The only simulated piece is the biometric device itself (no physical ZKTeco hardware is reachable during development), so a mock client stands in behind the exact same interface a real device SDK would implement. Swap one file and it talks to real hardware.

## 📑 Contents

- [Stack](#-stack)
- [Roles & Portals](#-roles--portals)
- [Core Modules](#-core-modules)
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
| **MANAGING DIRECTOR** | Same workbench as HR/Manager/Supervisor, minus System Settings (ADMIN-only). A dedicated MD dashboard is planned but not yet built |
| **MANAGER** | Own **Manager Portal** (`/manager-portal`): dashboard, My Leave, Leave Request, Leave on Behalf, Roster, Shift |
| **SUPERVISOR** | Own **Supervisor Portal** (`/supervisor-portal`), currently identical to the Manager Portal (the schema documents a narrower, tier-based intent for a future release) |
| **EMPLOYEE** | Own **Employee Portal** (`/employee-portal`): self-service dashboard, My Leave, Leave Request |

**Sign-in:** ADMIN/HR use a username and password on the staff login form; every other role signs in with their **Employee ID**. Each role lands on its own home route automatically after login. There is no shared "workbench" landing page for Manager/Supervisor/Employee accounts.

> 🔒 The **Roster** and **Shift** tabs in the Manager/Supervisor Portal are visible but locked ("coming soon"), held back for a future release.

---

## 🧩 Core Modules

| Module | What it does |
|--------|--------------|
| **Employees** | Full CRUD and the source of truth for the whole system. Each employee has a leave category (Permanent / Provision / Contractual / Trial) that drives their leave entitlement. |
| **Departments, Designations, Shifts** | Organizational structure and shift rules (hours, grace period, overtime). |
| **Department Superiors** | Who leads which department, resolved from both a department's designated head and any Supervisor configured as a fixed approver in that department's leave approval chain. |
| **Devices** | CRUD, connection control, and live sync against a ZKTeco biometric terminal ([details below](#-connecting-a-real-zkteco-device)). |
| **Attendance** | Punch ingestion from the device, manual punches, corrections, approvals, and a printable **Attendance Report**: a letterhead (company logo and name from Company Profile), a compact check-in/check-out table for the current filters, and totals, tuned to print cleanly on A4 without spilling across many pages. |
| **Leave Management** | A 7-type policy: Permanent, Provision (6-month probation), Contractual, Trial (custom duration set at hire), Compensatory (claimed against a specific overtime day), Maternity (2+ years tenure, up to 112 days, requires a document), and Unpaid. Balances, carry-forward rules, and anniversary-based resets are configured per employee category in **Leave Policy**; a daily scheduler handles rollovers and flags upcoming probation/trial deadlines. |
| **Dashboard** | Summary cards, charts, and (for Manager/Supervisor/HR/Admin) a live "Team on Leave" and team attendance view for the departments they lead. |
| **Reports** | 9 report types with CSV export. |
| **Audit Logs** | System-wide activity trail. |
| **System Settings** | ADMIN-only company profile: name, contact info, and a **company logo** used on the Attendance Report letterhead. |

<<<<<<< HEAD
## Quick Start (manual / local development)
=======
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

On first run, the backend pushes the Prisma schema to the database automatically. After the containers are up, **seed the demo data** (admin account, sample departments/shifts/employees):

```bash
docker compose exec backend npm run prisma:seed
```

Then open **http://localhost:3000** and sign in:

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@smarthrm.local   | Admin@123  |
| HR    | hr@smarthrm.local      | Hr@12345   |

---

## 🛠️ Quick Start (manual / local development)
>>>>>>> 4f0547ffeb100b39b360a2dd19576dcbb34b8ba0

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
npx prisma migrate dev --name init   # creates tables + migration history
npm run prisma:seed                  # optional demo data
npm run start:dev
```

The API runs on **http://localhost:4000/api** (Swagger UI at `/api/docs`).

> **Note:** `npx prisma generate` downloads Prisma's query engine binary from `binaries.prisma.sh`. If you're behind a restrictive firewall/proxy, make sure that domain is reachable. It is the only external dependency Prisma needs beyond the npm registry.

> **Upgrading an existing install:** run `npx prisma migrate dev` after pulling the latest. Recent additions (the 7-type leave policy fields, leave attachments, and the attendance-log uniqueness constraint) all require a migration. If a migration reports duplicate rows or employees missing a required field (e.g. `leaveCategory`), resolve those in the data before re-running.

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
│   │   ├── schema.prisma          Full data model (users, employees, devices, leave, attendance...)
│   │   └── seed.ts                Demo data seeder
│   └── src/
│       ├── auth/                  JWT login (staff + Employee ID), guards, role-based access
│       ├── users/                 Admin-managed HR/Manager/Supervisor accounts
│       ├── company/               Single-row company profile (incl. logo)
│       ├── employees/             Core employee CRUD (source of truth)
│       ├── departments/           Department CRUD
│       ├── department-superiors/  Department leadership resolution
│       ├── designations/          Job title CRUD
│       ├── shifts/                Shift definitions (hours, grace, overtime)
│       ├── roster/                Roster scheduling (locked in the UI, next release)
│       ├── devices/               Device CRUD + connection control + ZKTeco client
│       │   ├── zkteco/            ZktecoClient interface, mock + real implementations
│       │   └── device-sync.service.ts   Employee ⇄ device synchronization
│       ├── attendance/            Punch ingestion, processing, corrections, approvals
│       ├── leave/                 Leave requests, category policies, approval tiers, attachments
│       ├── dashboard/             Summary cards, chart data, team-on-leave / team-attendance
│       ├── reports/               9 report types + CSV export
│       ├── notifications/         In-app notifications
│       └── audit/                 System-wide audit logging
│
├── frontend/                      Next.js app
│   └── src/
│       ├── app/                   Routes: login, dashboard, employees, departments,
│       │                          designations, shifts, attendance, device, reports,
│       │                          leave, audit-logs, settings, workbench, and the
│       │                          role portals: employee-portal, manager-portal,
│       │                          supervisor-portal
│       ├── components/            UI primitives + feature components
│       ├── modules/               Portal views (Employee/Manager Portal), Personnel
│       │                          module screens (dashboard, attendance report, etc.)
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
Assigned department / designation / shift
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
Dashboard, printable Attendance Report, and the 9 report types
```

**Leave runs in parallel:** an Employee/Manager/Supervisor submits a request from their portal (or HR logs one on an employee's behalf), it routes through that department's approval chain, and approved leave feeds back into attendance status and the "Team on Leave" dashboard view.

---

## 🚧 Known limitations / next steps

- **Roster and Shift are locked** in the Manager/Supervisor Portal: visible with a "coming soon" indicator, intentionally held back for a future release.
- **Supervisor is currently identical to Manager** in the portal UI. The data model already supports a narrower, tier-based permission set (see the `Role` enum in `schema.prisma`).
- **Managing Director** has no dedicated dashboard yet and sees the same workbench as HR/Manager/Supervisor.
- **XLSX/PDF report export** is not yet implemented. CSV export is available for every report; the Attendance Report is print/PDF-via-browser only for now.
- **Real-time push sync** (device → server without polling) would require the ZKTeco Push SDK / webhook support instead of the current pull-based `POST /attendance/sync`.
- **Multi-device / multi-company** support is intentionally out of scope for v1. The schema and services are structured so both can be added later without a rewrite (`Device` and `Company` are already separate tables from `Employee`).
- **Employee document uploads** (resume, contract, certificates): the `Document` table and relations are ready, and leave attachments (for Maternity leave) are implemented, but a general-purpose upload endpoint is still open.
