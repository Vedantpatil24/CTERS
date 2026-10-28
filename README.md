# CTERS — Corporate Travel & Expense Reimbursement System

A complete, production-grade Software Engineering project implementing an end-to-end corporate travel request, itinerary coordination, expense reimbursement, policy validation, and immutable auditing platform.

---

## ⚡ Quick Start (≤ 5 Commands)

```bash
# 1. Navigate to project root
cd g:\SEM_5\SE\cters-app

# 2. Install all dependencies (root, server, client)
npm run build

# 3. Seed demo database with 15 EmployeeMaster records & pre-made lifecycle states
npm run seed

# 4. Start both Backend (port 5000) and Frontend (port 3000) concurrently
npm run dev

# 5. Run full automated test suite (23 must-pass rule & concurrency tests)
npm test
```

Frontend URL: **http://localhost:3000**  
Backend API URL: **http://localhost:5000/api**

To wipe and restore a pristine demo state at any point:
```bash
npm run reset-demo
```

---

## 🔑 Demo Seed Logins

All demo accounts share the password: **`Demo@1234`**

| Role | Employee ID | Email | Reports To / Notes |
|---|---|---|---|
| **Admin** | `EMP000` | `admin@cters.corp` | Full administrative control, policies, settings |
| **Manager 2 (Director)** | `EMP002` | `mgr2@cters.corp` | High-value Level 2 approvals (>₹50k travel, >₹25k claims) |
| **Manager 1** | `EMP001` | `mgr1@cters.corp` | Reports to `mgr2`; Approving Manager for `emp1`, `emp2` |
| **Employee 1** | `EMP003` | `emp1@cters.corp` | Senior Engineer (reports to `mgr1`); has pending travel `TR-00001` & booked trip `TR-00002` |
| **Employee 2** | `EMP004` | `emp2@cters.corp` | QA Engineer (reports to `mgr1`); has claim `CLM-00001` with policy violation flag |
| **Travel Desk** | `EMP005` | `travel1@cters.corp` | Coordinates confirmed flight/hotel bookings and costs |
| **Finance** | `EMP006` | `fin1@cters.corp` | Verifies claims, generates batches, exports CSV, confirms payout |
| **Auditor** | `EMP007` | `auditor1@cters.corp` | Read-only compliance review of immutable audit trail |
| **Unactivated Employee** | `EMP012` | `newjoiner@cters.corp` | Exists in HR Master; ready to test first-time activation with OTP |
| **Terminated Employee** | `EMP013` | `terminated@cters.corp` | Exists in HR Master with status `terminated`; login/token denied |

---

## 🏛️ Resolved Architectural Decisions

| Area | Decision & Implementation |
|---|---|
| **Travel Initial Status** | `submitted` (SRS FR-TRAVEL-03) |
| **Booking Overrun** | Default 20% (`bookingOverrunPct` setting); flags request for Admin review (`flaggedForAdmin`) |
| **Reimbursements vs Batches** | `ReimbursementBatch` groups claims for bank export; `Reimbursement` is 1-to-1 with `ExpenseClaim` (UNIQUE `claimId`) |
| **Receipt Requirements** | Mandatory for any line item > ₹1,000 (`receiptThresholdPaise`). Checked via magic bytes (JPEG/PNG/PDF ≤ 5 MB) |
| **Violation Handling** | Missing required receipt = **blocking violation** (blocks submission); Category limit exceeded = **non-blocking flag** (approver must justify) |
| **Self-Approval** | Strictly prohibited across travel and claims (`BR-03`, `FR-APPR-01`) |
| **High-Value Escalation** | Travel > ₹50,000, Claims > ₹25,000 automatically escalate Level 1 approval to Level 2 (approver's manager) |
| **HR Master Authority** | Nobody gets in unless they exist in `EmployeeMaster` with `employmentStatus = 'active'`. Re-checked on every authenticated request |
| **Audit Immutability** | Enforced by SQLite database triggers blocking any SQL `UPDATE` or `DELETE` |

---

## 📂 Project Structure

```
cters-app/
├── package.json             # Root monorepo scripts (dev, test, seed, reset-demo)
├── docs/
│   ├── openapi.yaml         # Complete OpenAPI 3.0 specification
│   ├── DEMO_SCRIPT.md       # 10-minute step-by-step evaluation walkthrough
│   ├── TRACEABILITY.md      # Requirements Traceability Matrix (FR/BR -> code -> tests)
│   └── ASSUMPTIONS.md       # Design decisions and architecture log
├── server/
│   ├── prisma/
│   │   ├── schema.prisma    # SQLite schema with foreign keys and indexes
│   │   └── seed.ts          # 15 HR masters, policy rules, and multi-stage demo records
│   ├── src/
│   │   ├── constants/       # Role names, allowed transition state maps, defaults
│   │   ├── middlewares/     # JWT authentication, HR active check, RBAC, error handler
│   │   ├── services/        # Business logic services (Auth, Travel, Approval, Claim, Policy, Reimbursement, Admin, Report, Audit)
│   │   ├── controllers/     # Express route handlers with Zod schema validation
│   │   ├── routes/          # Express route definitions
│   │   ├── utils/           # Business-day calculator and date helpers
│   │   ├── app.ts           # Express app setup and middleware
│   │   └── index.ts         # Bootstrap server with DB triggers
│   └── tests/               # 23 automated Vitest/Supertest test suites
└── client/
    ├── src/
    │   ├── api/             # Central fetch client with token management
    │   ├── context/         # AuthContext and role helpers
    │   ├── components/      # Navbar, StatusBadge
    │   ├── pages/           # Pages for all roles (Login, Activate, Travel, Approvals, Bookings, Claims, Finance, Admin, Audit, Outbox, Reports)
    │   ├── App.tsx          # React Router setup
    │   └── index.css        # Clean, accessible styling
    └── vite.config.ts       # Vite proxy config
```

---

## 🧪 Automated Test Suite (23 Tests)

Run tests anytime with:
```bash
npm test
```

Key test suites covered:
1. `auth_identity.test.ts` — HR Master verification, unactivated OTP flow, weak password rejection, OTP reuse denial, lockout after 5 attempts, immediate token lockout for terminated staff, generic error prevention of user enumeration.
2. `travel_approval.test.ts` — End date preceding start date rejection, short notice justification, overlap warnings, self-approval blocking, clarification loop, and Level 2 high-value escalation (>₹50,000).
3. `claim_policy.test.ts` — Claim submission against unbooked trip rejection, empty claim rejection, missing mandatory receipt blocking (HTTP 422), receipt magic byte verification, limit-exceeded non-blocking flags with mandatory justification, policy version snapshot immutability.
4. `reimbursement_concurrency.test.ts` — Finance verification, batch creation, export failure simulation, and **10 parallel confirm calls yielding exactly 1 reimbursement**.
5. `audit_rbac.test.ts` — SQLite trigger blocking UPDATE/DELETE on audit log table, and strict 403 Forbidden matrix across roles.
