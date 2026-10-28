import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma, initAuditTriggers } from '../src/prisma';
import { reseed } from './helpers/reseed';

let emp1Token = '';
let mgr1Token = '';
let mgr2Token = '';
let emp1UserId = '';

describe('Travel Request & Approval Workflow (FR-TRAVEL, FR-APPR, BR-03)', () => {
  beforeAll(async () => {
    await reseed();
    await initAuditTriggers();

    // Login emp1 (Alice Smith)
    const emp1Login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'emp1@cters.corp', password: 'Demo@1234' });
    emp1Token = emp1Login.body.token;
    emp1UserId = emp1Login.body.user.id;

    // Login mgr1 (Marcus Vance)
    const mgr1Login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'mgr1@cters.corp', password: 'Demo@1234' });
    mgr1Token = mgr1Login.body.token;

    // Login mgr2 (Dr. Evelyn Director)
    const mgr2Login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'mgr2@cters.corp', password: 'Demo@1234' });
    mgr2Token = mgr2Login.body.token;
  });

  it('rejects travel request where end date precedes start date (FR-TRAVEL-07)', async () => {
    const res = await request(app)
      .post('/api/travel-requests')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({
        destination: 'Goa Offsite',
        startDate: '2026-11-20',
        endDate: '2026-11-15', // End before start
        purpose: 'Annual engineering retreat',
        estimatedBudgetPaise: 2500000
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DATES');
  });

  it('requires justification text for short notice (<5 business days) (FR-TRAVEL-01)', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    const res = await request(app)
      .post('/api/travel-requests')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({
        destination: 'Mumbai Client Meeting',
        startDate: tomorrow.toISOString().slice(0, 10),
        endDate: dayAfter.toISOString().slice(0, 10),
        purpose: 'Emergency client issue',
        estimatedBudgetPaise: 1500000,
        shortNoticeReason: '' // Empty
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SHORT_NOTICE_JUSTIFICATION_REQUIRED');
  });

  it('blocks self-approval attempt (BR-03, FR-APPR-01)', async () => {
    // Raise a request as mgr1
    const createRes = await request(app)
      .post('/api/travel-requests')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        destination: 'Chennai Client Center',
        startDate: '2026-12-01',
        endDate: '2026-12-04',
        purpose: 'Quarterly review',
        estimatedBudgetPaise: 3000000
      });
    expect(createRes.status).toBe(201);
    const trId = createRes.body.id;

    // mgr1 attempts to approve own request
    const approveRes = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        entityType: 'TRAVEL_REQUEST',
        entityId: trId,
        decision: 'APPROVE',
        comment: 'Self approved'
      });

    expect(approveRes.status).toBe(403);
    expect(approveRes.body.code).toBe('SELF_APPROVAL_BLOCKED');
  });

  it('clarify loop and mandatory comments (FR-APPR-03, FR-APPR-04, FR-TRAVEL-05)', async () => {
    // 1. Employee raises travel request
    const createRes = await request(app)
      .post('/api/travel-requests')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({
        destination: 'Kolkata Data Center',
        startDate: '2026-12-10',
        endDate: '2026-12-14',
        purpose: 'Server migration',
        estimatedBudgetPaise: 2000000
      });
    expect(createRes.status).toBe(201);
    const trId = createRes.body.id;

    // 2. Manager attempts to clarify without a comment -> fails
    const failClarify = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        entityType: 'TRAVEL_REQUEST',
        entityId: trId,
        decision: 'CLARIFY',
        comment: ''
      });
    expect(failClarify.status).toBe(400);
    expect(failClarify.body.code).toBe('COMMENT_REQUIRED');

    // 3. Manager requests clarification with comment
    const okClarify = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        entityType: 'TRAVEL_REQUEST',
        entityId: trId,
        decision: 'CLARIFY',
        comment: 'Please clarify why 4 days are needed.'
      });
    expect(okClarify.status).toBe(200);

    // Verify status is clarification_requested
    const check1 = await request(app)
      .get(`/api/travel-requests/${trId}`)
      .set('Authorization', `Bearer ${emp1Token}`);
    expect(check1.body.status).toBe('clarification_requested');

    // 4. Employee edits and resubmits
    const updateRes = await request(app)
      .put(`/api/travel-requests/${trId}`)
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({
        purpose: 'Server migration including post-migration stability testing over 4 days.'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('submitted');

    // 5. Manager approves
    const approveRes = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        entityType: 'TRAVEL_REQUEST',
        entityId: trId,
        decision: 'APPROVE',
        comment: 'Clarification accepted, approved.'
      });
    expect(approveRes.status).toBe(200);
  });

  it('second-level approval for high-value travel request (>₹50,000) (Prompt Section 3 & 5)', async () => {
    // Alice submits high-value request > ₹50,000 (e.g. ₹60,000 = 6,000,000 paise)
    const createRes = await request(app)
      .post('/api/travel-requests')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send({
        destination: 'London Tech Conference',
        startDate: '2026-12-15',
        endDate: '2026-12-20',
        purpose: 'Speaker at Global DevOps Summit',
        estimatedBudgetPaise: 6000000 // ₹60,000
      });
    expect(createRes.status).toBe(201);
    const trId = createRes.body.id;

    // mgr1 approves Level 1
    const lvl1Res = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr1Token}`)
      .send({
        entityType: 'TRAVEL_REQUEST',
        entityId: trId,
        decision: 'APPROVE',
        comment: 'Approved Level 1'
      });

    expect(lvl1Res.status).toBe(200);
    expect(lvl1Res.body.message).toContain('escalated to Level 2');

    // Check request is still submitted/pending Level 2, currentApproverId is now mgr2
    const check1 = await request(app)
      .get(`/api/travel-requests/${trId}`)
      .set('Authorization', `Bearer ${emp1Token}`);
    expect(check1.body.status).toBe('submitted');

    // mgr2 (Director) approves Level 2
    const lvl2Res = await request(app)
      .post('/api/approvals/decide')
      .set('Authorization', `Bearer ${mgr2Token}`)
      .send({
        entityType: 'TRAVEL_REQUEST',
        entityId: trId,
        decision: 'APPROVE',
        comment: 'Executive Director Approval granted.'
      });

    expect(lvl2Res.status).toBe(200);

    // Final status is approved
    const check2 = await request(app)
      .get(`/api/travel-requests/${trId}`)
      .set('Authorization', `Bearer ${emp1Token}`);
    expect(check2.body.status).toBe('approved');
  });
});
