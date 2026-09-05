# Smart HRM — Centralized Human Resource & Biometric Management System

A full-stack HRM platform for managing employees, departments, shifts, attendance,
and a ZKTeco uFace 800 Plus biometric terminal from a single web application.

This is a **real, working codebase** — not a mockup. The only piece that's simulated
is the biometric device itself (no physical ZKTeco hardware is reachable during
development), so a mock client stands in behind the exact same interface a real
device SDK would implement. Swap one file and it talks to real hardware.

---

## Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS, React Query, Zustand, Recharts |
| Backend   | NestJS, TypeScript, Prisma ORM, PostgreSQL, JWT auth, class-validator |
| Device    | Mock ZKTeco uFace 800 Plus client (drop-in replaceable with a real SDK) |
| Infra     | Docker Compose (Postgres + backend + frontend) |

---

## Quick Start (Docker — recommended)

Requires Docker and Docker Compose.

```bash
docker compose up --build
```

This starts:
- PostgreSQL on `localhost:5432`
- Backend API on `http://localhost:4000/api` (Swagger docs at `/api/docs`)
- Frontend on `http://localhost:3000`

On first run, the backend pushes the Prisma schema to the database automatically.
**Seed demo data** (admin account, sample departments/shifts/employees) after the
containers are up:

```bash
docker compose exec backend npm run prisma:seed
```

Then open **http://localhost:3000** and sign in with:

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@smarthrm.local   | Admin@123  |
| HR    | hr@smarthrm.local      | Hr@12345   |

---

## Quick Start (manual / local development)

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

> Note: `npx prisma generate` downloads Prisma's query engine binary from
> `binaries.prisma.sh`. If you're behind a restrictive firewall/proxy, make sure
> that domain is reachable — this is the only external dependency Prisma needs
> beyond the npm registry.

> **Upgrading an existing install:** this update added a database-level
> unique constraint on `attendance_logs(employeeId, timestamp)` as a second
> line of defense against duplicate punches. Run
> `npx prisma migrate dev --name add_attendance_log_unique` to apply it — if
> you already have duplicate rows for the same employee/timestamp, Prisma
> will tell you so you can clean them up first.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL defaults to http://localhost:4000/api
npm install
npm run dev
```

Open **http://localhost:3000**.

---

## Project Structure

```
smart-hrm/
├── backend/                   NestJS API
│   ├── prisma/
│   │   ├── schema.prisma      Full data model (users, employees, devices, attendance...)
│   │   └── seed.ts            Demo data seeder
│   └── src/
│       ├── auth/              JWT login, guards, role-based access
│       ├── users/             Admin-managed HR/Manager accounts
│       ├── company/           Single-row company profile
│       ├── employees/         Core employee CRUD (source of truth)
│       ├── departments/       Department CRUD
│       ├── designations/      Job title CRUD
│       ├── shifts/            Shift definitions (hours, grace, overtime)
│       ├── devices/           Device CRUD + connection control + ZKTeco client
│       │   ├── zkteco/        ZktecoClient interface, mock + real implementations
│       │   └── device-sync.service.ts   Employee ⇄ device synchronization
│       ├── attendance/        Punch ingestion, processing, corrections, approvals
│       ├── dashboard/         Summary cards + chart data
│       ├── reports/           9 report types + CSV export
│       └── audit/             System-wide audit logging
│
├── frontend/                  Next.js app
│   └── src/
│       ├── app/                Routes: login, dashboard, employees, departments,
│       │                       designations, shifts, attendance, device, reports,
│       │                       audit-logs, settings
│       ├── components/         UI primitives + feature components
│       ├── hooks/               React Query hooks per resource
│       └── lib/                 API client, auth store, utilities
│
└── docker-compose.yml
```

---

## Connecting a real ZKTeco device

All device communication goes through the `ZktecoClient` interface in
`backend/src/devices/zkteco/zkteco-client.interface.ts`. Two implementations exist:

- **`ZktecoMockClient`** (default) — simulates a device in memory. No hardware
  needed.
- **`ZktecoRealClient`** — talks to a real ZKTeco uFace 800 Plus (or any device
  in the same protocol family) over TCP, using the
  [`node-zklib`](https://www.npmjs.com/package/node-zklib) library plus a few
  raw protocol commands `node-zklib` doesn't wrap on its own.

Which one is active is controlled entirely by an environment variable — **no code
changes needed** to switch:

```env
# backend/.env
ZKTECO_DRIVER="real"
```

### Before you flip the switch

1. **Make sure the device is reachable on your network** from the machine
   running the backend — same LAN/VLAN, correct static IP, and the
   communication port open (default `4370`, configurable on the device menu
   under `Comm → Ethernet`).
2. **Add the device in the app** (Device page → Add Device) with its real IP
   and port, or edit the seeded device record directly.
3. **Test read-only operations first.** Click **Test Connection**, then
   **Device Info**, then try **Sync from Device** on the Attendance page
   (pulls punch logs — read-only, safe). These exercise the well-tested parts
   of `node-zklib` and confirm connectivity before anything writes to the device.
4. **Test writes with one employee before bulk syncing.** Creating or editing
   a single employee pushes them to the device automatically. Confirm that
   employee actually appears correctly in the device's own user list (device
   menu → User Mgmt) before running **Bulk Sync All** against your full
   employee list.

### What's real vs. simplified in `ZktecoRealClient`

| Operation | Status |
|---|---|
| Connect / disconnect / test connection | Fully implemented via `node-zklib`, with an explicit connect timeout + retry-with-backoff (`node-zklib` itself never enforces a connect timeout — see code comments) |
| Pull attendance logs | Implemented via `node-zklib`; **punch direction (IN/OUT) is inferred** by alternating per employee per day, since the underlying library doesn't expose the device's actual in/out flag. Verify mode (fingerprint/face/RFID) is not exposed either and defaults to `FINGERPRINT` for all punches. Runs automatically every `ATTENDANCE_SYNC_INTERVAL_MS` in addition to the manual "Sync now" button. |
| Get device info (user count, storage) | Implemented via `node-zklib`. Fingerprint/face counts are **not** included — see below. |
| Get serial number / firmware version | Implemented via a raw protocol option query (`CMD_OPTIONS_RRQ`) — well-documented and read-only |
| Sync device time | Implemented via raw `CMD_SET_TIME`/`CMD_GET_TIME`, encoding verified against `node-zklib`'s own time decoder |
| Restart device | Implemented via raw `CMD_RESTART` |
| Push/update employee (`setUser`) | Implemented via raw `CMD_USER_WRQ` with a 72-byte user record. The field layout was reverse-derived directly from `node-zklib`'s own `decodeUserData72()` decoder (not guessed), so reads and writes agree. **This has not been validated against physical ZKTeco hardware** — test with one employee first (see above). |
| Delete employee | Implemented via raw `CMD_DELETE_USER` |
| Clear fingerprint/face templates only | Implemented via raw `CMD_DELETE_USERTEMP`, looping finger slots 0–9. The payload layout matches the widely-referenced `pyzk` protocol implementation of the same command, but like the other write operations **has not been validated against physical hardware** — test on a spare device first. |
| Automatic reconnection | If a command fails in a way that looks like a dropped socket, the client reconnects once and retries automatically — no manual "Connect" click needed after a network blip. A background heartbeat (`DEVICE_HEARTBEAT_INTERVAL_MS`) also pings every configured device and flips `connectionStatus` back to `ONLINE` in the database the moment it's reachable again. |
| Concurrent access safety | Commands against the same device are serialized through an internal queue — the ZK protocol is a strict single request/response session, so a scheduled sync and a UI click hitting the same device at once can no longer corrupt each other's replies. |
| Fingerprint / face counts in Device Info | **Not implemented.** The device's `CMD_GET_FREE_SIZES` reply does carry these on most firmwares, but at byte offsets this client couldn't verify against real hardware (no device was reachable in this environment) — reporting a wrong number that *looks* authoritative seemed worse than reporting 0. If you have a device, capture a raw reply (`zk.executeCmd(11, '')` after a `getInfo()` — see `readOption`) and adjust `getInfo()` in `zkteco-real-client.ts` once you've confirmed the layout. |

If your device needs different behavior (e.g. it doesn't support the 72-byte
user table, or exposes verify-mode/in-out-mode in a way you want decoded
properly), `zkteco-real-client.ts` is a single, self-contained file — the rest
of the app never needs to change since everything talks to the `ZktecoClient`
interface, not this class directly.

### Tuning connection behavior

All of these live in `backend/.env` (see `.env.example` for defaults):

| Variable | Default | Purpose |
|---|---|---|
| `ZKTECO_CONNECT_TIMEOUT_MS` | `8000` | Max time to wait for the initial TCP connect |
| `ZKTECO_RESPONSE_TIMEOUT_MS` | `8000` | Max time to wait for a reply to any single command once connected |
| `ZKTECO_CONNECT_RETRIES` | `2` | Extra connect attempts (with backoff) before giving up |
| `ZKTECO_IDLE_TIMEOUT_MS` | `300000` | Release a pooled connection after this much inactivity (most ZKTeco terminals only accept one active session at a time) |
| `ATTENDANCE_SYNC_INTERVAL_MS` | `300000` | How often to auto-pull attendance in the background; `0` disables it |
| `DEVICE_HEARTBEAT_INTERVAL_MS` | `60000` | How often to ping devices to keep `connectionStatus` accurate; `0` disables it |

---

## Core Workflow

```
Employee created in HRM
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
Reports & dashboard
```

---

## Default Roles

| Role       | Permissions |
|------------|-------------|
| ADMIN      | Full access — including user management, audit logs, device removal |
| HR         | Employee/attendance/department/shift management, device control, reports |
| MANAGER    | Read-only views of employees, attendance, and reports |

---

## Known limitations / next steps

- **XLSX/PDF report export** is not yet implemented — CSV export is available for
  every report. Adding `exceljs` (Excel) or the existing `pdf` skill pattern would
  extend this easily.
- **Real-time push sync** (device → server without polling) would require the
  ZKTeco Push SDK / webhook support instead of the current pull-based
  `POST /attendance/sync`.
- **Multi-device / multi-company** support is intentionally out of scope for v1,
  per the original spec — the schema and services are structured so both can be
  added later without a rewrite (e.g. `Device` and `Company` are already separate
  tables from `Employee`).
- Employee **document uploads** (resume, contract, certificates) have a `Document`
  table and relations ready, but no file upload endpoint yet — would pair well
  with S3-compatible storage.
