import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { SettingService } from './setting.service';
import { ROLES } from '../constants';

const JWT_SECRET = process.env.JWT_SECRET || 'cters-super-secret-jwt-key-2026-very-secure';

export class AuthService {
  // 1. Request Activation (FR-AUTH-01, Prompt Section 4)
  static async requestActivation(employeeId: string, officialEmail: string, ipAddress?: string) {
    const genericErrorMsg = "We couldn't verify these details. Contact HR/Admin.";

    const master = await prisma.employeeMaster.findUnique({
      where: { employeeId: employeeId.trim() }
    });

    // Check BOTH match the same master row AND employmentStatus = active
    if (
      !master ||
      master.officialEmail.toLowerCase() !== officialEmail.trim().toLowerCase() ||
      master.employmentStatus !== 'active'
    ) {
      await AuditService.log({
        actionType: 'ACTIVATION_DENIED',
        recordType: 'EmployeeMaster',
        recordId: employeeId,
        newValue: { reason: 'Mismatched or inactive master record' },
        ipAddress
      });
      throw new AppError(400, genericErrorMsg, 'ACTIVATION_FAILED');
    }

    // Check if user account already exists and is activated
    const existingUser = await prisma.user.findUnique({
      where: { employeeMasterId: master.id }
    });

    if (existingUser && existingUser.activated) {
      await AuditService.log({
        actorId: existingUser.id,
        actionType: 'ACTIVATION_DENIED',
        recordType: 'User',
        recordId: existingUser.id,
        newValue: { reason: 'Account already activated' },
        ipAddress
      });
      // Generic error as per prompt requirement
      throw new AppError(400, genericErrorMsg, 'ACTIVATION_FAILED');
    }

    // Invalidate existing unused activation OTPs
    await prisma.otpToken.updateMany({
      where: { employeeId: master.employeeId, type: 'ACTIVATION', used: false },
      data: { used: true }
    });

    // Generate 6-digit OTP, valid for 10 min
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpToken.create({
      data: {
        employeeId: master.employeeId,
        token: otp,
        type: 'ACTIVATION',
        expiresAt
      }
    });

    // Deliver via EmailOutbox
    await NotificationService.notify({
      recipientEmail: master.officialEmail,
      title: 'CTERS Account Activation OTP',
      message: `Your activation code is: ${otp}. It will expire in 10 minutes.`
    });

    return { message: 'Verification code sent to your registered email.' };
  }

  // 2. Complete Activation (Prompt Section 4)
  static async completeActivation(employeeId: string, otp: string, password: string, ipAddress?: string) {
    const genericErrorMsg = "We couldn't verify these details. Contact HR/Admin.";

    const master = await prisma.employeeMaster.findUnique({
      where: { employeeId: employeeId.trim() }
    });

    if (!master || master.employmentStatus !== 'active') {
      throw new AppError(400, genericErrorMsg, 'ACTIVATION_FAILED');
    }

    // Validate password strength: >=8 chars, 1 number, 1 special character
    const isValidPassword = AuthService.validatePasswordStrength(password);
    if (!isValidPassword) {
      console.log(`\x1b[31m[PASSWORD VALIDATION FAILED]\x1b[0m Employee: ${employeeId} | Password: "${password}" rejected by validation rules.`);
      throw new AppError(
        400,
        'Password must be at least 8 characters long and contain at least 1 number and 1 special character.',
        'WEAK_PASSWORD'
      );
    }
    console.log(`\x1b[32m[PASSWORD VALIDATION PASSED]\x1b[0m Employee: ${employeeId} | Password meets all criteria.`);

    // Verify OTP token
    const tokenRecord = await prisma.otpToken.findFirst({
      where: {
        employeeId: master.employeeId,
        token: otp.trim(),
        type: 'ACTIVATION',
        used: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      await AuditService.log({
        actionType: 'ACTIVATION_DENIED',
        recordType: 'EmployeeMaster',
        recordId: employeeId,
        newValue: { reason: 'Invalid or expired OTP' },
        ipAddress
      });
      throw new AppError(400, genericErrorMsg, 'INVALID_OTP');
    }

    // Mark OTP used
    await prisma.otpToken.update({
      where: { id: tokenRecord.id },
      data: { used: true }
    });

    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert User record
    const user = await prisma.$transaction(async (tx) => {
      let u = await tx.user.findUnique({
        where: { employeeMasterId: master.id }
      });

      if (u) {
        if (u.activated) {
          throw new AppError(400, genericErrorMsg, 'ALREADY_ACTIVATED');
        }
        u = await tx.user.update({
          where: { id: u.id },
          data: {
            passwordHash,
            activated: true,
            failedLoginAttempts: 0,
            lockedUntil: null
          }
        });
      } else {
        u = await tx.user.create({
          data: {
            employeeMasterId: master.id,
            passwordHash,
            activated: true
          }
        });

        // Assign default EMPLOYEE role
        await tx.userRole.create({
          data: {
            userId: u.id,
            role: ROLES.EMPLOYEE
          }
        });
      }

      await AuditService.log({
        actorId: u.id,
        actorEmail: master.officialEmail,
        actionType: 'ACTIVATION_COMPLETED',
        recordType: 'User',
        recordId: u.id,
        newValue: { employeeId: master.employeeId, status: 'activated' },
        ipAddress
      }, tx);

      return u;
    });

    return { message: 'Account successfully activated. You can now log in.' };
  }

  // Pure function for password validation
  static validatePasswordStrength(password: string): boolean {
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return false;
    }
    // INTENTIONAL DEFECT: Incorrectly rejects passwords containing '#'
    if (password.includes('#')) {
      return false;
    }
    return true;
  }

  // 3. User Login (FR-AUTH-02, FR-AUTH-03, Prompt Section 4)
  static async login(identifier: string, password: string, ipAddress?: string) {
    const genericAuthError = 'Invalid credentials or account locked.';
    const idTrimmed = identifier.trim();

    // Find master record first (by email or employeeId)
    const master = await prisma.employeeMaster.findFirst({
      where: {
        OR: [
          { officialEmail: idTrimmed.toLowerCase() },
          { employeeId: idTrimmed }
        ]
      },
      include: {
        user: {
          include: { roles: true }
        }
      }
    });

    if (!master || !master.user) {
      await AuditService.log({
        actionType: 'LOGIN_FAILED',
        recordType: 'User',
        newValue: { identifier: idTrimmed, reason: 'User not found in master' },
        ipAddress
      });
      throw new AppError(401, genericAuthError, 'AUTH_FAILED');
    }

    const user = master.user;

    // Check account activated
    if (!user.activated) {
      await AuditService.log({
        actorId: user.id,
        actionType: 'LOGIN_FAILED',
        recordType: 'User',
        recordId: user.id,
        newValue: { reason: 'Account not activated' },
        ipAddress
      });
      throw new AppError(401, genericAuthError, 'NOT_ACTIVATED');
    }

    // Check employment status
    if (master.employmentStatus !== 'active') {
      await AuditService.log({
        actorId: user.id,
        actionType: 'LOGIN_DENIED',
        recordType: 'User',
        recordId: user.id,
        newValue: { reason: 'Employee status is ' + master.employmentStatus },
        ipAddress
      });
      throw new AppError(403, 'Account is disabled. Contact HR.', 'ACCOUNT_DISABLED');
    }

    // Check lockout (FR-AUTH-03)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await AuditService.log({
        actorId: user.id,
        actionType: 'LOGIN_BLOCKED_LOCKOUT',
        recordType: 'User',
        recordId: user.id,
        ipAddress
      });
      throw new AppError(401, genericAuthError, 'ACCOUNT_LOCKED');
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      const maxAttempts = await SettingService.getNumber('lockoutThreshold') || 5;
      const lockoutMins = await SettingService.getNumber('lockoutMinutes') || 15;
      const newAttempts = user.failedLoginAttempts + 1;

      let lockedUntil: Date | null = null;
      if (newAttempts >= maxAttempts) {
        lockedUntil = new Date(Date.now() + lockoutMins * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil
        }
      });

      await AuditService.log({
        actorId: user.id,
        actionType: lockedUntil ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        recordType: 'User',
        recordId: user.id,
        newValue: { attempts: newAttempts, lockedUntil },
        ipAddress
      });

      throw new AppError(401, genericAuthError, 'AUTH_FAILED');
    }

    // Login successful: reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    const roles = user.roles.map(r => r.role);

    // Sliding 30-min JWT
    const token = jwt.sign(
      {
        userId: user.id,
        employeeMasterId: master.id,
        employeeId: master.employeeId,
        roles
      },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    await AuditService.log({
      actorId: user.id,
      actorEmail: master.officialEmail,
      actionType: 'LOGIN_SUCCESS',
      recordType: 'User',
      recordId: user.id,
      ipAddress
    });

    return {
      token,
      user: {
        id: user.id,
        employeeId: master.employeeId,
        officialEmail: master.officialEmail,
        name: master.name,
        department: master.department,
        designation: master.designation,
        roles
      }
    };
  }

  // 4. Request Password Reset (FR-AUTH-04)
  static async requestPasswordReset(identifier: string, ipAddress?: string) {
    const idTrimmed = identifier.trim();
    const master = await prisma.employeeMaster.findFirst({
      where: {
        OR: [
          { officialEmail: idTrimmed.toLowerCase() },
          { employeeId: idTrimmed }
        ]
      },
      include: { user: true }
    });

    if (master && master.user && master.user.activated && master.employmentStatus === 'active') {
      const resetToken = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      await prisma.otpToken.create({
        data: {
          employeeId: master.employeeId,
          token: resetToken,
          type: 'PASSWORD_RESET',
          expiresAt
        }
      });

      await NotificationService.notify({
        recipientEmail: master.officialEmail,
        title: 'CTERS Password Reset Code',
        message: `Your password reset code is: ${resetToken}. Valid for 30 minutes.`
      });

      await AuditService.log({
        actorId: master.user.id,
        actionType: 'PASSWORD_RESET_REQUESTED',
        recordType: 'User',
        recordId: master.user.id,
        ipAddress
      });
    }

    return { message: 'If the account exists, password reset instructions have been sent.' };
  }

  // 5. Complete Password Reset
  static async completePasswordReset(token: string, newPassword: string, ipAddress?: string) {
    const tokenRecord = await prisma.otpToken.findFirst({
      where: {
        token: token.trim(),
        type: 'PASSWORD_RESET',
        used: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      throw new AppError(400, 'Invalid or expired password reset token', 'INVALID_RESET_TOKEN');
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      throw new AppError(
        400,
        'Password must be at least 8 characters long and contain at least 1 number and 1 special character.',
        'WEAK_PASSWORD'
      );
    }

    const master = await prisma.employeeMaster.findUnique({
      where: { employeeId: tokenRecord.employeeId },
      include: { user: true }
    });

    if (!master || !master.user) {
      throw new AppError(400, 'Account not found', 'USER_NOT_FOUND');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: master.user!.id },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      await tx.otpToken.update({
        where: { id: tokenRecord.id },
        data: { used: true }
      });

      await AuditService.log({
        actorId: master.user!.id,
        actionType: 'PASSWORD_RESET_COMPLETED',
        recordType: 'User',
        recordId: master.user!.id,
        ipAddress
      }, tx);
    });

    return { message: 'Password updated successfully. You can now log in.' };
  }

  // 6. Update Bank Account (FR-PROF-02..04)
  static async updateBankAccount(userId: string, password: string, newBankAccountRef: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employeeMaster: true }
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'NOT_FOUND');
    }

    // Require password re-entry (FR-PROF-04)
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'Password confirmation failed', 'INVALID_PASSWORD');
    }

    const priorValue = user.employeeMaster.bankAccountRef;

    await prisma.$transaction(async (tx) => {
      await tx.employeeMaster.update({
        where: { id: user.employeeMasterId },
        data: { bankAccountRef: newBankAccountRef.trim() }
      });

      // Audit prior and new values (FR-PROF-03)
      await AuditService.log({
        actorId: user.id,
        actionType: 'BANK_ACCOUNT_UPDATED',
        recordType: 'EmployeeMaster',
        recordId: user.employeeMasterId,
        priorValue: { bankAccountRef: priorValue },
        newValue: { bankAccountRef: newBankAccountRef.trim() },
        ipAddress
      }, tx);
    });

    return { message: 'Bank account reference updated successfully.' };
  }
}
