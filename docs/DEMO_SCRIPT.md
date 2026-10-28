# CTERS — 10-Minute Comprehensive Live Demo Script

This script provides step-by-step instructions to showcase the complete Corporate Travel & Expense Reimbursement System (CTERS) workflow, including HR identity verification, policy enforcement, multi-level approvals, travel booking, receipt validation, and finance disbursement.

---

## 0. Prerequisites & Quick Setup

1. Start both backend and frontend with a single command from `cters-app`:
   ```bash
   npm run dev
   ```
2. Open browser at: `http://localhost:3000`
3. If you ever need to reset to pristine demo data:
   ```bash
   npm run reset-demo
   ```

**Default password for all demo accounts:** `Demo@1234`

---

## Step 1: Employee Identity Verification & Security Boundary (2 mins)

> **Goal:** Prove that nobody gets into the system without an active record in the HR Employee Master, and that terminated employees are instantly locked out.

1. Navigate to `http://localhost:3000/activate` (or click **"Activate Account"** on the Login screen).
2. **Test 1.1: Not-in-Database Denied**
   - Enter Employee ID: `EMP999`
   - Enter Email: `imposter@cters.corp`
   - Click **"Verify Details & Send OTP"**.
   - **Expected Result:** Red alert: *"We couldn't verify these details. Contact HR/Admin."* (Generic error prevents user enumeration).
3. **Test 1.2: Terminated Employee Denied**
   - Enter Employee ID: `EMP013`
   - Enter Email: `terminated@cters.corp`
   - Click **"Verify Details & Send OTP"**.
   - **Expected Result:** Denied with the identical generic message.
4. **Test 1.3: Successful Activation via OTP**
   - Enter Employee ID: `EMP012`
   - Enter Email: `newjoiner@cters.corp` (Nancy Newcomer, unactivated demo employee).
   - Click **"Verify Details & Send OTP"**.
   - **Result:** Success banner informs verification code was dispatched!
   - Open the **Outbox** tab in the top navigation or at `http://localhost:3000/outbox`.
   - Locate the most recent email titled *"CTERS Account Activation OTP"*. Note the 6-digit code (e.g. `123456`).
   - Return to Activate, enter the OTP, enter new password `SecurePassword@2026`, confirm password, and click **"Set Password & Activate"**.
   - **Expected Result:** Alert confirms account activated. Log in immediately using `EMP012` and `SecurePassword@2026`.

---

## Step 2: Raise Travel Request & Manager Routing (2 mins)

1. Click **One-Click Demo Switcher** at Login: click **"Employee 1"** (`emp1@cters.corp`).
2. Navigate to **Travel** (`/travel`) -> click **"+ New Travel Request"**.
3. Fill out the form:
   - **Destination:** `Bangalore Executive Summit`
   - **Category:** `Project Planning`
   - **Start Date:** Choose a date 7 days from now.
   - **End Date:** 10 days from now.
   - **Estimated Budget:** `₹45,000`
   - **Purpose:** `Client executive sync and roadmap review`
   - Click **"Submit Request"**.
4. **Result:** Travel request `TR-00005` created with status `submitted`.
5. Notice that it was automatically routed to Alice's designated Approving Manager, **Marcus Vance (`mgr1`)**, configured in the Employee Master.

---

## Step 3: Self-Approval Blocked & Manager Approval (1.5 mins)

1. Log out or switch to **Manager 1** (`mgr1@cters.corp`).
2. Navigate to **Approvals** (`/approvals`).
3. You will see pending requests from team members (Alice and Bob).
4. Notice that Marcus Vance cannot see or approve any requests raised by himself (Self-approval strictly blocked by Rule BR-03).
5. Locate Alice's request `TR-00005`, click **"Approve"**.
6. Enter comment: *"Approved for business trip."* -> click **"Confirm APPROVE"**.
7. **Result:** Request status transitions to `approved`. Notifications are dispatched to Alice and to the Travel Desk coordinator.

---

## Step 4: Travel Desk Records Confirmed Itinerary (1.5 mins)

1. Switch to **Travel Desk** (`travel1@cters.corp`).
2. Click **Booking Queue** (`/bookings`).
3. You will see Alice's approved request `TR-00005` in the queue.
4. Click **"Book Itinerary"**:
   - Component 1: `Flight`, Vendor: `IndiGo`, Booking Ref: `6E-7890-BLR`, Cost: `₹22,000`.
   - Click **"+ Add Component"**.
   - Component 2: `Hotel`, Vendor: `Taj Bangalore`, Booking Ref: `TAJ-55419`, Cost: `₹18,000`.
   - Total Actual Cost = `₹40,000` (within estimated budget).
   - Click **"Record Itinerary & Mark Booked"**.
5. **Result:** Request updates to `booked`. Alice can now view the confirmed itinerary and submit an expense claim against this trip!

---

## Step 5: Expense Claim, Receipt Magic Bytes & Policy Validation (2 mins)

1. Switch to **Employee 1** (`emp1@cters.corp`).
2. Go to **Claims** (`/claims`) -> click **"+ Create New Claim"**.
3. Select the trip just booked (`TR-00005`) -> click **"Create Draft & Add Items"**.
4. On the Claim Detail screen:
   - **Add Item 1:** Category `Meals`, Date today, Amount `₹1,800`.
   - Notice the total updates to `₹1,800.00`.
5. **Test Missing Mandatory Receipt (> ₹1,000):**
   - Click **"Dry-Run Policy Check (FR-POLICY-05)"**.
   - **Result:** Blocking violation flagged: *"Line amount of ₹1,800.00 exceeds receipt threshold of ₹1,000.00, but no receipt is attached."*
   - Attempt to click **"Submit Claim to Manager"**.
   - **Result:** Error banner: *"Claim submission blocked due to policy violations (missing required receipts)."* Claim safely stays in `draft`.
6. **Attach Receipt:**
   - Under the item, click **"+ Attach Receipt"**.
   - Choose any valid JPEG, PNG, or PDF file (e.g. `tests/test_receipt.pdf`).
   - Click **"Upload"**. File magic bytes are verified and receipt appears.
7. Click **"Submit Claim to Manager"**.
   - **Result:** Claim validates cleanly, policy snapshot recorded (`v1`), status moves to `pending_approval`.

---

## Step 6: Approval of Claim with Policy Flag (1 min)

1. Switch to **Manager 1** (`mgr1@cters.corp`) -> go to **Approvals** (`/approvals`).
2. Review seeded claim `CLM-00001` submitted by Bob (`emp2`), which has non-blocking flags for exceeding category spending limits.
3. Click **"Approve"**.
4. Notice the reminder: *"A justification comment is required to approve despite flagged violations (FR-POLICY-07)"*.
5. Enter comment: *"Client dinner pre-approved by VP; override justified."*
6. Click **"Confirm APPROVE"**. Status updates to `approved` and claim moves to Finance queue.

---

## Step 7: Finance Verification, Batching, Bank CSV Export & Disbursement (2 mins)

1. Switch to **Finance** (`fin1@cters.corp`).
2. Go to **Finance** (`/finance`).
3. You will see approved claims in the queue.
4. Click **"Verify & Ready"** on approved claim.
   - Status updates to `processed_by_finance` ("Ready for Disbursement").
5. Check the box next to the verified claim and click **"Create Reimbursement Batch (1)"**.
   - Batch is created with a unique reference number (e.g. `BATCH-20261008-0002`).
6. Under **Reimbursement Batches**:
   - Click **"📥 Export Bank CSV"**.
   - Browser immediately downloads the bank-formatted CSV file with headers: `employee_id,employee_name,bank_ref,amount,claim_ref,batch_ref`.
7. Click **"Confirm Disbursement"**:
   - Enter bank transfer UTR: `NEFT-AXIS-20261008-001`.
   - Click **"Confirm Bank Transfer"**.
8. **Result:** In one atomic database transaction:
   - Unique `Reimbursement` record is created.
   - Claim status transitions to `reimbursed`.
   - Email and in-app notifications sent to the employee.

---

## Step 8: Compliance Audit Verification (30 secs)

1. Switch to **Auditor** (`auditor1@cters.corp`) -> go to **Audit Logs** (`/audit`).
2. Observe every action performed during the demo:
   - `ACTIVATION_COMPLETED`
   - `TRAVEL_REQUEST_SUBMITTED`
   - `TRAVEL_REQUEST_APPROVED`
   - `ITINERARY_BOOKED`
   - `CLAIM_SUBMITTED`
   - `CLAIM_APPROVED`
   - `REIMBURSEMENT_BATCH_EXPORTED`
   - `CLAIM_REIMBURSED`
3. Database triggers guarantee no user (including Administrator) can tamper with or delete these records.

**Demo Complete!**
