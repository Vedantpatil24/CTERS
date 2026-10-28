import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma, initAuditTriggers } from '../src/prisma';
import { reseed } from './helpers/reseed';

let fin1Token = '';
let adminToken = '';

describe('Reimbursement, Export Failure, and Concurrency Suite (FR-REIMB-01..07, BR-5)', () => {
  beforeAll(async () => {
    await reseed();
    await initAuditTriggers();

    const fin1Login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'fin1@cters.corp', password: 'Demo@1234' });
    fin1Token = fin1Login.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@cters.corp', password: 'Demo@1234' });
    adminToken = adminLogin.body.token;
  });

  it('finance verification and batch creation (FR-REIMB-01, FR-REIMB-02)', async () => {
    // Seeded claim CLM-00002 is already processed_by_finance
    const readyClaim = await prisma.expenseClaim.findFirst({
      where: { claimNo: 'CLM-00002' }
    });
    expect(readyClaim).toBeTruthy();

    // Create batch
    const batchRes = await request(app)
      .post('/api/finance/batches')
      .set('Authorization', `Bearer ${fin1Token}`)
      .send({ claimIds: [readyClaim!.id] });

    expect(batchRes.status).toBe(201);
    expect(batchRes.body.batchRef).toBeTruthy();
    expect(batchRes.body.status).toBe('created');
  });

  it('export failure simulation keeps claims ready and alerts finance (Prompt Section 5)', async () => {
    // 1. Enable simulateExportFailure
    await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ simulateExportFailure: 'true' });

    // Find the created batch
    const batch = await prisma.reimbursementBatch.findFirst({
      where: { status: 'created' }
    });
    expect(batch).toBeTruthy();

    // Attempt export
    const exportRes = await request(app)
      .get(`/api/finance/batches/${batch!.id}/export-csv`)
      .set('Authorization', `Bearer ${fin1Token}`);

    expect(exportRes.status).toBe(500);
    expect(exportRes.body.code).toBe('EXPORT_FAILED');

    // Claims in the batch are still processed_by_finance (not lost or corrupted)
    const claim = await prisma.expenseClaim.findFirst({ where: { claimNo: 'CLM-00002' } });
    expect(claim!.status).toBe('processed_by_finance');

    // Disable simulation
    await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ simulateExportFailure: 'false' });

    // Retry export -> succeeds
    const retryRes = await request(app)
      .get(`/api/finance/batches/${batch!.id}/export-csv`)
      .set('Authorization', `Bearer ${fin1Token}`);

    expect(retryRes.status).toBe(200);
    expect(retryRes.text).toContain('employee_id,employee_name,bank_ref,amount,claim_ref,batch_ref');
    expect(retryRes.text).toContain('CLM-00002');
  });

  it('concurrency test: 10 parallel confirm calls -> exactly one reimbursement succeeds (Prompt Section 5 & 8)', async () => {
    const batch = await prisma.reimbursementBatch.findFirst({
      where: { status: 'exported' }
    });
    expect(batch).toBeTruthy();

    const claimBefore = await prisma.expenseClaim.findFirst({
      where: { claimNo: 'CLM-00002' }
    });
    expect(claimBefore).toBeTruthy();

    // Fire 10 concurrent requests to confirm the batch
    const parallelCalls = Array.from({ length: 10 }).map(() =>
      request(app)
        .post(`/api/finance/batches/${batch!.id}/confirm`)
        .set('Authorization', `Bearer ${fin1Token}`)
        .send({ paymentReference: 'NEFT-CONCURRENCY-TEST-2026' })
    );

    const results = await Promise.all(parallelCalls);

    // Count successful vs conflict responses
    const successful = results.filter(r => r.status === 200);
    const nonSuccessful = results.filter(r => r.status !== 200);

    expect(successful.length).toBe(1);
    expect(nonSuccessful.length).toBe(9);

    // Verify in database: exactly ONE reimbursement record exists for this claim!
    const reimbursements = await prisma.reimbursement.findMany({
      where: { claimId: claimBefore!.id }
    });
    expect(reimbursements.length).toBe(1);
    expect(reimbursements[0].paymentReference).toBe('NEFT-CONCURRENCY-TEST-2026');

    // Claim status is reimbursed
    const claimAfter = await prisma.expenseClaim.findUnique({ where: { id: claimBefore!.id } });
    expect(claimAfter!.status).toBe('reimbursed');
  });
});
