# CTERS — Requirements Traceability Matrix (RTM)

This document maps every Functional Requirement (FR), Business Rule (BR), Non-Functional Requirement (NFR), and Architectural Directive to its corresponding API Endpoint, Implementation File, and Automated Test Case.

---

## 1. Authentication & Employee Identity Verification

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-AUTH-01** | Admin create user account from Employee Master | `POST /api/admin/users`<br>`AdminService.createUserFromMaster()` | `auth_identity.test.ts` | Verified |
| **FR-AUTH-02** | User login with registered email/ID & password | `POST /api/auth/login`<br>`AuthService.login()` | `auth_identity.test.ts` | Verified |
| **FR-AUTH-03** | 15-min lockout after 5 consecutive failed logins | `POST /api/auth/login`<br>`AuthService.login()` | `auth_identity.test.ts` | Verified |
| **FR-AUTH-04** | Password reset via 30-min emailed token | `POST /api/auth/request-password-reset`<br>`POST /api/auth/complete-password-reset` | `auth_identity.test.ts` | Verified |
| **FR-AUTH-05** | 30-minute sliding session expiration | `JWT 30m expiresIn`<br>`middlewares/auth.ts` | `auth_identity.test.ts` | Verified |
| **FR-AUTH-06** | Strict Role-Based Access Control (RBAC) | `requireRole()` middleware | `audit_rbac.test.ts` | Verified |
| **Section 4 (HR)** | Nobody gets in unless they exist in EmployeeMaster | `POST /api/auth/request-activation`<br>`AuthService.requestActivation()` | `auth_identity.test.ts` | Verified |
| **Section 4 (HR)** | Generic error message for any verification failure | `AuthService.requestActivation()` | `auth_identity.test.ts` | Verified |
| **Section 4 (HR)** | Terminated employee token invalidation immediately | `authenticateToken()` middleware re-checks HR Master | `auth_identity.test.ts` | Verified |
| **Section 4 (HR)** | Single-use 10-minute 6-digit OTP for activation | `POST /api/auth/complete-activation` | `auth_identity.test.ts` | Verified |

---

## 2. Profile Management

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-PROF-01** | View user profile details | `GET /api/profile` | `profile.controller.ts` | Verified |
| **FR-PROF-02** | Update bank account reference | `PUT /api/profile/bank`<br>`AuthService.updateBankAccount()` | `auth_identity.test.ts` | Verified |
| **FR-PROF-03** | Audit bank changes with prior and new values | `AuditService.log('BANK_ACCOUNT_UPDATED')` | `auth_identity.test.ts` | Verified |
| **FR-PROF-04** | Mandatory password re-entry for bank update | `AuthService.updateBankAccount()` | `auth_identity.test.ts` | Verified |
| **FR-PROF-05** | View designated Approving Manager | `GET /api/profile` (resolves `reportsToEmployeeId`) | `profile.controller.ts` | Verified |

---

## 3. Travel Request Management

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-TRAVEL-01** | Submit travel request with dates, purpose, budget | `POST /api/travel-requests`<br>`TravelService.createTravelRequest()` | `travel_approval.test.ts` | Verified |
| **FR-TRAVEL-02** | Sequential unique travel request number (`TR-XXXXX`) | `TravelService.createTravelRequest()` | `travel_approval.test.ts` | Verified |
| **FR-TRAVEL-03** | Initial status set to `submitted` | `TravelService.createTravelRequest()` | `travel_approval.test.ts` | Verified |
| **FR-TRAVEL-04** | Supporting documents attachment | `TravelAttachment` schema | `travel.service.ts` | Verified |
| **FR-TRAVEL-05** | Edit only in `submitted` or `clarification_requested` | `PUT /api/travel-requests/:id` | `travel_approval.test.ts` | Verified |
| **FR-TRAVEL-06** | Cancel request only before approval | `POST /api/travel-requests/:id/cancel` | `travel.service.ts` | Verified |
| **FR-TRAVEL-07** | Reject if travel end date precedes start date | `TravelService.createTravelRequest()` | `travel_approval.test.ts` | Verified |
| **FR-TRAVEL-08** | View status of all submitted travel requests | `GET /api/travel-requests` | `travel_approval.test.ts` | Verified |

---

## 4. Approval Workflow

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-APPR-01** | Route request to designated Approving Manager | `TravelService.createTravelRequest()` | `travel_approval.test.ts` | Verified |
| **FR-APPR-02** | Approving Manager approves request | `POST /api/approvals/decide` | `travel_approval.test.ts` | Verified |
| **FR-APPR-03** | Mandatory comment for rejection | `ApprovalService.decide()` | `travel_approval.test.ts` | Verified |
| **FR-APPR-04** | Clarification loop returns to `clarification_requested` | `ApprovalService.decide()` | `travel_approval.test.ts` | Verified |
| **FR-APPR-05** | Immediate notifications on status change | `NotificationService.notify()` | `travel_approval.test.ts` | Verified |
| **FR-APPR-06** | Pending queue sorted by submission date | `ApprovalService.listPendingApprovals()` | `travel_approval.test.ts` | Verified |
| **FR-APPR-07** | Record approver identity, decision, date | `Approval` table in `prisma.$transaction` | `travel_approval.test.ts` | Verified |
| **BR-03** | Block self-approval strictly | `ApprovalService.decideTravelRequest()` | `travel_approval.test.ts` | Verified |
| **Threshold Rule** | Amount > ₹50,000 escalates to Level 2 (Director) | `ApprovalService.decideTravelRequest()` | `travel_approval.test.ts` | Verified |

---

## 5. Travel Booking Coordination

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-BOOK-01** | Notify Travel Desk when request is approved | `ApprovalService.decide()` (notifies TRAVEL_DESK) | `travel_approval.test.ts` | Verified |
| **FR-BOOK-02** | Travel Desk records confirmed itinerary & components | `POST /api/bookings/travel-requests/:id/itinerary` | `booking.service.ts` | Verified |
| **FR-BOOK-03** | Record actual booking costs per component | `ItineraryComponent` table | `booking.service.ts` | Verified |
| **FR-BOOK-04** | Update request status to `booked` | `BookingService.recordItinerary()` | `booking.service.ts` | Verified |
| **FR-BOOK-05** | Employee can view confirmed itinerary | `GET /api/travel-requests/:id` | `booking.service.ts` | Verified |
| **FR-BOOK-06** | Flag for Admin review if actual cost exceeds overrun % | `BookingService.recordItinerary()` | `booking.service.ts` | Verified |
| **BR-2** | Booking allowed only for `approved` requests | `BookingService.recordItinerary()` | `booking.service.ts` | Verified |

---

## 6. Expense Claims & Receipts

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-CLAIM-01** | Create expense claim linked to booked/completed trip | `POST /api/claims`<br>`ClaimService.createClaimDraft()` | `claim_policy.test.ts` | Verified |
| **FR-CLAIM-02** | Add itemized expense lines (category, amount, date) | `POST /api/claims/:id/lines` | `claim_policy.test.ts` | Verified |
| **FR-CLAIM-03** | Auto-calculate total claimed amount | `ClaimService.addLine()` | `claim_policy.test.ts` | Verified |
| **FR-CLAIM-04** | Save claim in `draft` status | `ClaimService.createClaimDraft()` | `claim_policy.test.ts` | Verified |
| **FR-CLAIM-05** | Assign sequential claim number (`CLM-XXXXX`) on submit | `ClaimService.createClaimDraft()` | `claim_policy.test.ts` | Verified |
| **FR-CLAIM-06** | Reject submission with zero expense lines | `POST /api/claims/:id/submit` | `claim_policy.test.ts` | Verified |
| **FR-CLAIM-07** | Withdraw claim back to draft before approval | `POST /api/claims/:id/withdraw` | `claim_policy.test.ts` | Verified |
| **FR-RCPT-01** | Upload receipt (JPEG, PNG, PDF <= 5MB) | `POST /api/claims/:id/lines/:lineId/receipts` | `claim_policy.test.ts` | Verified |
| **FR-RCPT-02** | View, replace, or remove receipt prior to submit | `DELETE /api/claims/:id/lines/:lineId/receipts/:id` | `claim_policy.test.ts` | Verified |
| **FR-RCPT-03** | Retain receipts after reimbursement | Schema cascade rules preserve receipts | `claim_policy.test.ts` | Verified |
| **FR-RCPT-04** | Read-only receipt access for Manager, Finance, Auditor | `GET /api/receipts/:receiptId/download` | `claim.controller.ts` | Verified |
| **FR-RCPT-05** | Verify magic bytes and reject invalid/oversized files | `verifyMagicBytes()` utility | `claim_policy.test.ts` | Verified |
| **BR-3** | Claim linked to exactly one travel request | Schema unique `travelRequestId` constraint | `claim_policy.test.ts` | Verified |

---

## 7. Policy Compliance Engine

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-POLICY-01** | Validate expense against category spending limit | `PolicyService.evaluateLines()` | `claim_policy.test.ts` | Verified |
| **FR-POLICY-02** | Flag limit exceeded as non-blocking violation | `PolicyService.evaluateLines()` | `claim_policy.test.ts` | Verified |
| **FR-POLICY-03** | Mandatory receipt for item > ₹1,000 threshold | `PolicyService.evaluateLines()` | `claim_policy.test.ts` | Verified |
| **FR-POLICY-04** | Block submission if mandatory receipt is missing | `POST /api/claims/:id/submit` (HTTP 422) | `claim_policy.test.ts` | Verified |
| **FR-POLICY-05** | Dry-run policy check endpoint | `POST /api/claims/:id/validate` | `claim_policy.test.ts` | Verified |
| **FR-POLICY-06** | Display flagged violations to manager | `GET /api/approvals/pending` includes `violations` | `travel_approval.test.ts` | Verified |
| **FR-POLICY-07** | Approve despite flag requires mandatory justification | `ApprovalService.decideExpenseClaim()` | `claim_policy.test.ts` | Verified |

---

## 8. Reimbursement & Finance Processing

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-REIMB-01** | Approved claims routed to Finance queue | `GET /api/finance/claims-queue` | `reimbursement_concurrency.test.ts` | Verified |
| **FR-REIMB-02** | Finance marks claim `processed_by_finance` | `POST /api/finance/claims/:id/verify` | `reimbursement_concurrency.test.ts` | Verified |
| **FR-REIMB-03** | Generate bank export CSV (`batchRef`) | `GET /api/finance/batches/:id/export-csv` | `reimbursement_concurrency.test.ts` | Verified |
| **FR-REIMB-04** | Update status to `reimbursed` on disbursement | `POST /api/finance/batches/:id/confirm` | `reimbursement_concurrency.test.ts` | Verified |
| **FR-REIMB-05** | Record payment reference and payment date | `Reimbursement` table | `reimbursement_concurrency.test.ts` | Verified |
| **FR-REIMB-06** | Return claim for correction with stated reason | `POST /api/finance/claims/:id/return` | `reimbursement.controller.ts` | Verified |
| **FR-REIMB-07** | Notify employee when claim is disbursed | `NotificationService.notify()` | `reimbursement_concurrency.test.ts` | Verified |
| **BR-5** | Only Finance may mark claim as reimbursed | RBAC `requireRole(ROLES.FINANCE, ROLES.ADMIN)` | `audit_rbac.test.ts` | Verified |
| **Concurrency** | 10 parallel confirm calls -> exactly one succeeds | `prisma.$transaction` + UNIQUE `claimId` | `reimbursement_concurrency.test.ts` | Verified |
| **REL-01** | Export failure keeps claims ready | `simulateExportFailure` setting | `reimbursement_concurrency.test.ts` | Verified |

---

## 9. Administrator & Audit Logs

| Requirement ID | Description | API Endpoint / Service | Test Case | Status |
|---|---|---|---|---|
| **FR-ADMIN-01** | Policy rules CRUD with versioning | `POST /api/admin/policies` | `claim_policy.test.ts` | Verified |
| **FR-ADMIN-02** | Rule version snapshot preserves historical claims | `PolicyService.getActiveRules()` | `claim_policy.test.ts` | Verified |
| **FR-ADMIN-03** | Configure lockout, session, overrun %, thresholds | `GET /api/admin/settings`<br>`PUT /api/admin/settings` | `reimbursement_concurrency.test.ts` | Verified |
| **FR-ADMIN-04** | Reassign pending approval tasks & escalation | `POST /api/admin/approvals/reassign`<br>`POST /api/admin/run-escalation` | `admin.service.ts` | Verified |
| **FR-AUDIT-01** | Record audit entry for all state changes & actions | `AuditService.log()` | `auth_identity.test.ts` | Verified |
| **FR-AUDIT-02** | Record audit entry for administrative changes | `AdminService` logs all config & master updates | `audit_rbac.test.ts` | Verified |
| **FR-AUDIT-03** | Database triggers prevent UPDATE and DELETE | `block_audit_update` & `block_audit_delete` | `audit_rbac.test.ts` | Verified |
| **FR-AUDIT-04** | Search & filter audit logs by user, date, action | `GET /api/audit-logs` | `audit_rbac.test.ts` | Verified |
