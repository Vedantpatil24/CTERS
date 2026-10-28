import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { AdminService } from '../services/admin.service';
import { SettingService } from '../services/setting.service';

const createEmployeeMasterSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  officialEmail: z.string().email('Valid official email is required'),
  name: z.string().min(1, 'Name is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  reportsToEmployeeId: z.string().optional(),
  bankAccountRef: z.string().optional(),
  employmentStatus: z.enum(['active', 'terminated', 'on_leave']).optional()
});

const createUserSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  roles: z.array(z.string()).min(1, 'At least one role is required')
});

const updateRolesSchema = z.object({
  roles: z.array(z.string()).min(1, 'At least one role is required')
});

const reassignManagerSchema = z.object({
  newManagerEmployeeId: z.string().min(1, 'New manager employee ID is required')
});

const reassignApprovalSchema = z.object({
  approvalId: z.string().min(1, 'Approval ID is required'),
  newApproverId: z.string().min(1, 'New approver user ID is required')
});

const createPolicySchema = z.object({
  category: z.string().min(1, 'Category is required'),
  limitAmountPaise: z.number().int().positive('Limit amount must be positive'),
  receiptThresholdPaise: z.number().int().nonnegative('Receipt threshold must be non-negative'),
  noticePeriodDays: z.number().int().positive().optional()
});

export class AdminController {
  // Employee Master
  static async listEmployees(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const list = await AdminService.listEmployees();
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  }

  static async createEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createEmployeeMasterSchema.parse(req.body);
      const result = await AdminService.createEmployeeMaster(req.user!.userId, data, req.ip);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async importEmployeesCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      let csvContent = '';
      if (req.file) {
        csvContent = req.file.buffer ? req.file.buffer.toString('utf-8') : require('fs').readFileSync(req.file.path, 'utf-8');
      } else if (req.body.csv) {
        csvContent = req.body.csv;
      } else {
        return res.status(400).json({ message: 'No CSV file or data uploaded' });
      }

      const result = await AdminService.importEmployeesCsv(req.user!.userId, csvContent, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // User Management
  static async listUsers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const users = await AdminService.listUsers();
      res.status(200).json(users);
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await AdminService.createUserFromMaster(req.user!.userId, data.employeeId, data.roles, req.ip);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }

  static async updateRoles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateRolesSchema.parse(req.body);
      const result = await AdminService.updateUserRoles(req.user!.userId, req.params.id, data.roles, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deactivateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AdminService.deactivateUser(req.user!.userId, req.params.id, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async reassignManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = reassignManagerSchema.parse(req.body);
      const result = await AdminService.reassignManager(req.user!.userId, req.params.id, data.newManagerEmployeeId, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Approval Reassignment & Escalation
  static async reassignApproval(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = reassignApprovalSchema.parse(req.body);
      const result = await AdminService.reassignPendingApproval(req.user!.userId, data.approvalId, data.newApproverId, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async runEscalation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AdminService.runEscalationJob(req.user!.userId, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Policies
  static async listPolicies(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const policies = await AdminService.listPolicies();
      res.status(200).json(policies);
    } catch (err) {
      next(err);
    }
  }

  static async createPolicy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createPolicySchema.parse(req.body);
      const policy = await AdminService.createPolicyRule(req.user!.userId, data, req.ip);
      res.status(201).json(policy);
    } catch (err) {
      next(err);
    }
  }

  static async deactivatePolicy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AdminService.deactivatePolicyRule(req.user!.userId, req.params.id, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Settings
  static async getSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const settings = await SettingService.getAll();
      res.status(200).json(settings);
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updates = req.body;
      for (const [key, value] of Object.entries(updates)) {
        await SettingService.set(key, String(value));
      }
      res.status(200).json({ message: 'Settings updated successfully' });
    } catch (err) {
      next(err);
    }
  }
}
