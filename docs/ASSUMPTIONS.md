# CTERS — Architectural Assumptions & Decisions Log

This document records the resolved design choices, edge case handling, and default policies implemented in the Corporate Travel & Expense Reimbursement System (CTERS) in alignment with the SRS, UML diagrams, DFDs, and prompt specifications.

---

## 1. Resolved Decisions from Prompt Section 3

1. **Travel Request Statuses**:
   `submitted`, `clarification_requested`, `approved`, `rejected`, `booked`, `completed`, `cancelled`.
   - Initial status upon submission: `submitted` (SRS FR-TRAVEL-03).
   - Only `booked` or `completed` travel requests can have an Expense Claim submitted against them (BR-2).

2. **Claim Statuses**:
   `draft`, `submitted`, `under_policy_validation`, `flagged_for_correction`, `pending_approval`, `approved`, `rejected`, `clarification_requested`, `processed_by_finance`, `reimbursed`.
   - `processed_by_finance` is equivalent to "Ready for Disbursement" (FR-REIMB-02).
   - `flagged_for_correction` indicates Finance returned the claim for corrections (FR-REIMB-06).

3. **Booking Overrun Threshold**:
   Configurable in system settings under `bookingOverrunPct` (default: 20%). If actual total booking cost exceeds `estimatedBudget * (1 + bookingOverrunPct/100)`, the request is flagged for administrator review (`flaggedForAdmin`).

4. **Reimbursements & Batches**:
   - `ReimbursementBatch`: Groups multiple finance-approved claims (`processed_by_finance`) for bank export.
   - `Reimbursement`: One-to-one with `ExpenseClaim` (UNIQUE `claimId`). Recorded when Finance marks disbursement confirmed.

5. **Receipt Requirements & Threshold**:
   - 0–5 receipts per expense line (`FR-RCPT-01..02`).
   - Receipts are mandatory if line amount > receipt threshold (configurable setting `receiptThresholdPaise`, default ₹1,000 / 100,000 paise).
   - Missing required receipt is a **blocking violation** (blocks submission).
   - Category limit exceeded is a **non-blocking flag** (approver can approve with mandatory justification comment).

6. **Second-Level Approval Thresholds**:
   - Travel Request > ₹50,000 (5,000,000 paise).
   - Expense Claim > ₹25,000 (2,500,000 paise).
   - When amount exceeds the threshold, Level 1 approval routes the item to Level 2 approval (the Level 1 approver's manager).

---

## 2. Employee Identity Verification (Prompt Section 4)

1. **HR Master Authority**:
   - `EmployeeMaster` is the HR source of truth. Nobody can activate an account or log in unless their record exists in `EmployeeMaster` with `employmentStatus = 'active'`.
   - On every authenticated API request, JWT authentication middleware validates that the user's linked `EmployeeMaster` record has `employmentStatus = 'active'`. Inactive or terminated employees are immediately rejected with HTTP 403.

2. **Activation Protocol**:
   - Step 1: User provides `employeeId` + `officialEmail`.
   - Both must match an existing row where `employmentStatus = 'active'` and `activated = false`.
   - Failure returns the generic message: `"We couldn't verify these details. Contact HR/Admin."` (prevents user enumeration).
   - Generates a 6-digit OTP valid for 10 minutes, logged to `EmailOutbox`.
   - Step 2: User provides `employeeId`, `otp`, and sets a password (≥8 characters, ≥1 number, ≥1 special character).
   - User account is activated (`activated = true`), default role `EMPLOYEE` assigned.

3. **Account Lockout**:
   - 5 consecutive failed login attempts trigger a 15-minute lockout.
   - Generic error messages for failed attempts.
   - Password reset via 30-minute token sent to `EmailOutbox`.

4. **Bank Details Privacy**:
   - Bank details (`bankAccountRef`) masked to the last 4 characters for all users except the owner and Finance team members.
   - Modifying bank details requires password confirmation and generates an audit log entry with prior and new values.

---

## 3. Financial Representation

- All monetary amounts are stored as integers in **paise** (1 INR = 100 paise) to prevent floating-point rounding inaccuracies.
- UI displays formatted INR (₹).

---

## 4. Audit Log Immutability

- `AuditLogEntry` records actor ID, action type, record type, record ID, prior value, new value, and timestamp.
- DB triggers and Prisma service layer disallow UPDATE and DELETE on audit logs.
- Audit entries can be queried and filtered by Auditor and Admin roles.
