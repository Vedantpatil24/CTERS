import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { AuthenticatedRequest, AuthUser } from '../types';
import { AppError } from './errorHandler';
import { ROLES } from '../constants';

const JWT_SECRET = process.env.JWT_SECRET || 'cters-super-secret-jwt-key-2026-very-secure';

export async function authenticateToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return next(new AppError(401, 'Authentication token required', 'UNAUTHORIZED'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;

    // Check user exists and is activated
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        employeeMaster: true,
        roles: true
      }
    });

    if (!user) {
      return next(new AppError(401, 'Account does not exist', 'UNAUTHORIZED'));
    }

    // MANDATORY (Prompt Section 4): Re-check master employmentStatus = active
    // "terminated/inactive employees are locked out immediately and existing tokens stop working"
    if (user.employeeMaster.employmentStatus !== 'active') {
      return next(new AppError(403, 'Account is disabled. Contact HR.', 'ACCOUNT_DISABLED'));
    }

    if (!user.activated) {
      return next(new AppError(401, 'Account is not activated', 'UNAUTHORIZED'));
    }

    req.user = {
      userId: user.id,
      employeeMasterId: user.employeeMasterId,
      employeeId: user.employeeMaster.employeeId,
      officialEmail: user.employeeMaster.officialEmail,
      name: user.employeeMaster.name,
      department: user.employeeMaster.department,
      roles: user.roles.map(r => r.role)
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Session expired. Please log in again.', 'TOKEN_EXPIRED'));
    }
    return next(new AppError(401, 'Invalid authentication token', 'INVALID_TOKEN'));
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      return next(new AppError(403, 'Forbidden: Insufficient privileges', 'FORBIDDEN'));
    }

    next();
  };
}

export function maskBankAccount(accountRef?: string | null): string {
  if (!accountRef) return '';
  if (accountRef.length <= 4) return accountRef;
  const last4 = accountRef.slice(-4);
  return 'X'.repeat(accountRef.length - 4) + last4;
}
