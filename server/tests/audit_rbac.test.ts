import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma, initAuditTriggers } from '../src/prisma';
import { reseed } from './helpers/reseed';

let emp1Token = '';
let fin1Token = '';
let travel1Token = '';
let auditor1Token = '';
let adminToken = '';

describe('Audit Immutability & RBAC Forbidden Matrix (FR-AUDIT, SEC-01..05)', () => {
  beforeAll(async () => {
    await reseed();
    await initAuditTriggers();

    const emp1 = await request(app).post('/api/auth/login').send({ identifier: 'emp1@cters.corp', password: 'Demo@1234' });
    emp1Token = emp1.body.token;

    const fin1 = await request(app).post('/api/auth/login').send({ identifier: 'fin1@cters.corp', password: 'Demo@1234' });
    fin1Token = fin1.body.token;

    const travel1 = await request(app).post('/api/auth/login').send({ identifier: 'travel1@cters.corp', password: 'Demo@1234' });
    travel1Token = travel1.body.token;

    const auditor1 = await request(app).post('/api/auth/login').send({ identifier: 'auditor1@cters.corp', password: 'Demo@1234' });
    auditor1Token = auditor1.body.token;

    const admin = await request(app).post('/api/auth/login').send({ identifier: 'admin@cters.corp', password: 'Demo@1234' });
    adminToken = admin.body.token;
  });

  it('DB triggers block UPDATE and DELETE on AuditLogEntry (FR-AUDIT-03)', async () => {
    // Create an audit entry
    const entry = await prisma.auditLogEntry.create({
      data: {
        actionType: 'TEST_ACTION',
        recordType: 'TestRecord',
        newValue: 'Immutable test'
      }
    });

    // Attempt direct SQL UPDATE -> Trigger blocks it
    await expect(
      prisma.$executeRawUnsafe(`UPDATE AuditLogEntry SET newValue = 'tampered' WHERE id = '${entry.id}'`)
    ).rejects.toThrow(/Audit logs are immutable and cannot be updated/);

    // Attempt direct SQL DELETE -> Trigger blocks it
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM AuditLogEntry WHERE id = '${entry.id}'`)
    ).rejects.toThrow(/Audit logs are immutable and cannot be deleted/);
  });

  it('RBAC matrix: enforces strict 403 Forbidden for unauthorized roles (FR-AUTH-06)', async () => {
    // 1. Employee forbidden from Admin routes
    const empAdmin = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${emp1Token}`);
    expect(empAdmin.status).toBe(403);

    // 2. Employee forbidden from Finance batches
    const empFinance = await request(app)
      .get('/api/finance/batches')
      .set('Authorization', `Bearer ${emp1Token}`);
    expect(empFinance.status).toBe(403);

    // 3. Employee forbidden from Audit logs
    const empAudit = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${emp1Token}`);
    expect(empAudit.status).toBe(403);

    // 4. Finance forbidden from recording Travel Desk itinerary
    const finBooking = await request(app)
      .get('/api/bookings/queue')
      .set('Authorization', `Bearer ${fin1Token}`);
    expect(finBooking.status).toBe(403);

    // 5. Travel desk forbidden from finance batches
    const travelBatch = await request(app)
      .get('/api/finance/batches')
      .set('Authorization', `Bearer ${travel1Token}`);
    expect(travelBatch.status).toBe(403);

    // 6. Auditor can view Audit logs
    const auditorAudit = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${auditor1Token}`);
    expect(auditorAudit.status).toBe(200);

    // 7. Auditor cannot create travel requests or batches
    const auditorCreateBatch = await request(app)
      .post('/api/finance/batches')
      .set('Authorization', `Bearer ${auditor1Token}`)
      .send({ claimIds: [] });
    expect(auditorCreateBatch.status).toBe(403);
  });
});
