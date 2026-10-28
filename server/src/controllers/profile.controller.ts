import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../types';
import { AuthService } from '../services/auth.service';
import { maskBankAccount } from '../middlewares/auth';
import { ROLES } from '../constants';

const updateBankSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required'),
  bankAccountRef: z.string().min(4, 'Valid bank account reference is required')
});

export class ProfileController {
  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: {
          employeeMaster: true,
          roles: true
        }
      });

      if (!user) return res.status(404).json({ message: 'User not found' });

      // Find reporting manager name (FR-PROF-05)
      let designatedManager: any = null;
      if (user.employeeMaster.reportsToEmployeeId) {
        const mgr = await prisma.employeeMaster.findUnique({
          where: { employeeId: user.employeeMaster.reportsToEmployeeId }
        });
        if (mgr) {
          designatedManager = {
            employeeId: mgr.employeeId,
            name: mgr.name,
            designation: mgr.designation,
            department: mgr.department
          };
        }
      }

      // Check if caller can see unmasked bank account: owner or Finance team member (Prompt Section 4)
      const isFinance = user.roles.some(r => r.role === ROLES.FINANCE || r.role === ROLES.ADMIN);
      const bankAccountRef = user.employeeMaster.bankAccountRef;
      const maskedBank = maskBankAccount(bankAccountRef);

      res.status(200).json({
        id: user.id,
        employeeId: user.employeeMaster.employeeId,
        name: user.employeeMaster.name,
        officialEmail: user.employeeMaster.officialEmail,
        department: user.employeeMaster.department,
        designation: user.employeeMaster.designation,
        bankAccountRef: isFinance ? bankAccountRef : maskedBank,
        rawBankAccountRef: bankAccountRef, // owner viewing own profile
        designatedManager,
        roles: user.roles.map(r => r.role)
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateBank(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateBankSchema.parse(req.body);
      const result = await AuthService.updateBankAccount(
        req.user!.userId,
        data.password,
        data.bankAccountRef,
        req.ip
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
