import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app';
import { prisma, initAuditTriggers } from '../src/prisma';
import { reseed } from './helpers/reseed';

let emp1Token = '';
let mgr1Token = '';
let adminToken = '';
let testPdfPath = '';
let invalidFakeFilePath = '';

describe('Expense Claims & Policy Engine Suite (FR-CLAIM, FR-RCPT, FR-POLICY)', () => {
  beforeAll(async () => {
    await reseed();
    await initAuditTriggers();

    const emp1Login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'emp1@cters.corp', password: 'Demo@1234' });
    emp1Token = emp1Login.body.token;

    const mgr1Login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'mgr1@cters.corp', password: 'Demo@1234' });
    mgr1Token = mgr1Login.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@cters.corp', password: 'Demo@1234' });
    adminToken = adminLogin.body.token;

    // Create a real small PDF for testing magic bytes
    testPdfPath = path.join(__dirname, 'test_receipt.pdf');
    fs.writeFileSync(testPdfPath, '%PDF-1.4\n%test PDF receipt content\n%%EOF');

    // Create an invalid file with fake extension
    invalidFakeFilePath = path.join(__dirname, 'fake.pdf');
    fs.writeFileSync(invalidFakeFilePath, 'NOT_A_REAL_PDF_FILE_HEADER_TEXT');
  });

  it('rejects claim creation against unbooked travel request (BR-2)', async () => {
    // Find unbooked travel request (TR-00001 is submitted)
    const tr = await prisma.travelRequest.findFirst({ where: { status: 'submitted' } });
    expect(tr).toBeTruthy();

    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({ travelRequestId: tr!.id, description: 'Premature claim attempt' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRAVEL_STATE');
  });

  it('rejects empty claim submission with zero items (FR-CLAIM-06)', async () => {
    const bookedTr = await prisma.travelRequest.findFirst({ where: { requestNo: 'TR-00002' } });
    expect(bookedTr).toBeTruthy();

    const draftRes = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({ travelRequestId: bookedTr!.id, description: 'Test Empty Claim' });
    expect(draftRes.status).toBe(201);
    const claimId = draftRes.body.id;

    // Attempt to submit zero-line claim
    const subRes = await request(app)
      .post(`/api/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${emp1Token}`);

    expect(subRes.status).toBe(400);
    expect(subRes.body.code).toBe('EMPTY_CLAIM');
  });

  it('blocks submission when mandatory receipt (>₹1,000) is missing (FR-POLICY-03, FR-POLICY-04, BR-4)', async () => {
    const bookedTr = await prisma.travelRequest.findFirst({ where: { requestNo: 'TR-00002' } });
    expect(bookedTr).toBeTruthy();

    // Create draft claim
    const draftRes = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({ travelRequestId: bookedTr!.id, description: 'Missing Receipt Test' });
    const claimId = draftRes.body.id;

    // Add expense line of ₹2,000 (200,000 paise) which is > ₹1,000 threshold
    const lineRes = await request(app)
      .post(`/api/claims/${claimId}/lines`)
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({
        category: 'Hotel',
        date: '2026-10-02',
        amountPaise: 200000,
        description: 'Hotel stay'
      });
    expect(lineRes.status).toBe(201);

    // Dry-run validate
    const dryRun = await request(app)
      .post(`/api/claims/${claimId}/validate`)
      .set('Authorization', `Bearer ${emp1Token}`);
    expect(dryRun.status).toBe(200);
    expect(dryRun.body.hasBlocking).toBe(true);

    // Final submit must be blocked with HTTP 422
    const subRes = await request(app)
      .post(`/api/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${emp1Token}`);

    expect(subRes.status).toBe(422);
    expect(subRes.body.code).toBe('POLICY_VIOLATION_BLOCKING');
  });

  it('validates receipt magic bytes and allows submission when receipt is attached (FR-RCPT-01, FR-RCPT-05)', async () => {
    const bookedTr = await prisma.travelRequest.findFirst({ where: { requestNo: 'TR-00002' } });
    expect(bookedTr).toBeTruthy();

    const draftRes = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({ travelRequestId: bookedTr!.id, description: 'Receipt Upload Test' });
    const claimId = draftRes.body.id;

    const lineRes = await request(app)
      .post(`/api/claims/${claimId}/lines`)
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({
        category: 'Meals',
        date: '2026-10-02',
        amountPaise: 150000, // ₹1,500 > ₹1,000
        description: 'Client Lunch'
      });
    const lineId = lineRes.body.id;

    // Attempt upload with fake file header -> fails magic bytes check
    const fakeUpload = await request(app)
      .post(`/api/claims/${claimId}/lines/${lineId}/receipts`)
      .set('Authorization', `Bearer ${emp1Token}`)
      .attach('file', invalidFakeFilePath);
    expect(fakeUpload.status).toBe(400);
    expect(fakeUpload.body.code).toBe('INVALID_FILE_TYPE');

    // Upload valid PDF
    const okUpload = await request(app)
      .post(`/api/claims/${claimId}/lines/${lineId}/receipts`)
      .set('Authorization', `Bearer ${emp1Token}`)
      .attach('file', testPdfPath);
    expect(okUpload.status).toBe(201);

    // Submit now succeeds
    const subRes = await request(app)
      .post(`/api/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${emp1Token}`);

    expect(subRes.status).toBe(200);
    expect(subRes.body.status).toBe('pending_approval');
  });

  it('limit-exceeded raises non-blocking flag and requires justification to approve (FR-POLICY-01, FR-POLICY-07)', async () => {
    // CLM-00001 was seeded for Bob (emp2) with Meals > ₹2,500 limit and has non-blocking flag
    const claim = await prisma.expenseClaim.findFirst({
      where: { claimNo: 'CLM-00001' }
    });
    expect(claim).toBeTruthy();

    // mgr1 attempts to approve without comment -> fails
    const failApprove = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        entityType: 'EXPENSE_CLAIM',
        entityId: claim!.id,
        decision: 'APPROVE',
        comment: ''
      });
    expect(failApprove.status).toBe(400);
    expect(failApprove.body.code).toBe('OVERRIDE_JUSTIFICATION_REQUIRED');

    // mgr1 approves with justification comment -> succeeds
    const okApprove = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        entityType: 'EXPENSE_CLAIM',
        entityId: claim!.id,
        decision: 'APPROVE',
        comment: 'Client entertainment pre-approved by VP; override justified.'
      });
    expect(okApprove.status).toBe(200);
  });

  it('policy version snapshot preserves submission version even if policy is updated (FR-ADMIN-02)', async () => {
    // Check active version
    const ruleBefore = await prisma.policyRule.findFirst({ where: { category: 'Meals', active: true } });
    expect(ruleBefore).toBeTruthy();
    const originalVersion = ruleBefore!.version;

    // Admin updates Meals policy (creates Version 2)
    const newPolicyRes = await request(app)
      .post('/api/admin/policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        category: 'Meals',
        limitAmountPaise: 400000, // new limit ₹4,000
        receiptThresholdPaise: 150000
      });
    expect(newPolicyRes.status).toBe(201);
    expect(newPolicyRes.body.version).toBeGreaterThan(originalVersion);

    // Existing submitted claim CLM-00001 still references version 1
    const clm = await prisma.expenseClaim.findFirst({ where: { claimNo: 'CLM-00001' } });
    expect(clm!.policyVersionUsed).toBe(1);
  });
});
