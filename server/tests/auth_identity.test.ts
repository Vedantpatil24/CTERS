import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma, initAuditTriggers } from '../src/prisma';
import { reseed } from './helpers/reseed';

const GENERIC_ACTIVATION_MSG = "We couldn't verify these details. Contact HR/Admin.";

describe('Employee Identity Verification Suite (Section 4, FR-AUTH-01..05)', () => {
  beforeAll(async () => {
    await reseed();
    await initAuditTriggers();
  });

  it('not-in-master employee ID is denied with generic error', async () => {
    const res = await request(app)
      .post('/api/auth/request-activation')
      .send({ employeeId: 'INVALID999', officialEmail: 'fake@cters.corp' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(GENERIC_ACTIVATION_MSG);
  });

  it('wrong email for valid employee ID is denied with identical generic error', async () => {
    const res = await request(app)
      .post('/api/auth/request-activation')
      .send({ employeeId: 'EMP012', officialEmail: 'wrong.email@cters.corp' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(GENERIC_ACTIVATION_MSG);
  });

  it('already-activated user cannot re-activate (denied with identical generic error)', async () => {
    const res = await request(app)
      .post('/api/auth/request-activation')
      .send({ employeeId: 'EMP003', officialEmail: 'emp1@cters.corp' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(GENERIC_ACTIVATION_MSG);
  });

  it('terminated employee cannot request activation or log in', async () => {
    // Attempt activation
    const res1 = await request(app)
      .post('/api/auth/request-activation')
      .send({ employeeId: 'EMP013', officialEmail: 'terminated@cters.corp' });

    expect(res1.status).toBe(400);
    expect(res1.body.message).toBe(GENERIC_ACTIVATION_MSG);

    // Attempt login
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'EMP013', password: 'Demo@1234' });

    expect(res2.status).toBe(401);
  });

  it('terminated employee with an existing valid token is locked out immediately on authenticated request', async () => {
    const termMaster = await prisma.employeeMaster.findUnique({ where: { employeeId: 'EMP013' }, include: { user: true } });
    expect(termMaster).toBeTruthy();

    const secret = process.env.JWT_SECRET || 'cters-super-secret-jwt-key-2026-very-secure';
    const oldToken = jwt.sign(
      {
        userId: termMaster!.user!.id,
        employeeMasterId: termMaster!.id,
        employeeId: termMaster!.employeeId,
        roles: ['EMPLOYEE']
      },
      secret,
      { expiresIn: '30m' }
    );

    const res = await request(app)
      .get('/api/travel-requests')
      .set('Authorization', `Bearer ${oldToken}`);

    // Must be HTTP 403 Account Disabled
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('successful activation flow: generates OTP, verifies OTP, rejects reuse/expiry', async () => {
    // 1. Request activation for unactivated Nancy Newcomer (EMP012)
    const reqRes = await request(app)
      .post('/api/auth/request-activation')
      .send({ employeeId: 'EMP012', officialEmail: 'newjoiner@cters.corp' });

    expect(reqRes.status).toBe(200);

    // Fetch the OTP from OtpToken table
    const otpRecord = await prisma.otpToken.findFirst({
      where: { employeeId: 'EMP012', type: 'ACTIVATION', used: false },
      orderBy: { createdAt: 'desc' }
    });
    expect(otpRecord).toBeTruthy();
    const validOtp = otpRecord!.token;

    // 2. Reject weak password (<8 chars or missing special char)
    const weakRes = await request(app)
      .post('/api/auth/complete-activation')
      .send({ employeeId: 'EMP012', otp: validOtp, password: 'weak' });
    expect(weakRes.status).toBe(400);
    expect(weakRes.body.code).toBe('WEAK_PASSWORD');

    // 3. Complete activation with strong password
    const actRes = await request(app)
      .post('/api/auth/complete-activation')
      .send({ employeeId: 'EMP012', otp: validOtp, password: 'SecurePassword@2026' });
    expect(actRes.status).toBe(200);

    // 4. OTP reuse must fail
    const reuseRes = await request(app)
      .post('/api/auth/complete-activation')
      .send({ employeeId: 'EMP012', otp: validOtp, password: 'SecurePassword@2026' });
    expect(reuseRes.status).toBe(400);

    // 5. Newly activated user can now log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'EMP012', password: 'SecurePassword@2026' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.user.employeeId).toBe('EMP012');
  });

  it('account lockout after 5 consecutive failed login attempts', async () => {
    const identifier = 'emp1@cters.corp';

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier, password: 'WrongPassword999!' });
      expect(res.status).toBe(401);
    }

    // 6th attempt should be blocked by lockout
    const lockRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier, password: 'Demo@1234' });

    expect(lockRes.status).toBe(401);
    expect(lockRes.body.message).toBe('Invalid credentials or account locked.');

    // Reset user failed attempts to restore demo state
    await prisma.user.updateMany({
      where: { employeeMaster: { officialEmail: identifier } },
      data: { failedLoginAttempts: 0, lockedUntil: null }
    });
  });
});
