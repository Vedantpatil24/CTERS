import { prisma } from '../prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { SettingService } from './setting.service';
import { getBusinessDaysBetween } from '../utils/date';
import { ROLES } from '../constants';

export class AdminService {
  // 1. EmployeeMaster Management (Prompt Section 4)
  static async listEmployees() {
    return await prisma.employeeMaster.findMany({
      include: {
        user: {
          include: { roles: true }
        }
      },
      orderBy: { employeeId: 'asc' }
    });
  }

  static async createEmployeeMaster(
    adminUserId: string,
    data: {
      employeeId: string;
      officialEmail: string;
      name: string;
      department: string;
      designation: string;
      reportsToEmployeeId?: string;
      bankAccountRef?: string;
      employmentStatus?: string;
    },
    ipAddress?: string
  ) {
    const existing = await prisma.employeeMaster.findFirst({
      where: {
        OR: [
          { employeeId: data.employeeId.trim() },
          { officialEmail: data.officialEmail.trim().toLowerCase() }
        ]
      }
    });

    if (existing) {
      throw new AppError(400, 'Employee ID or email already exists in Employee Master', 'DUPLICATE_EMPLOYEE');
    }

    const employee = await prisma.employeeMaster.create({
      data: {
        employeeId: data.employeeId.trim(),
        officialEmail: data.officialEmail.trim().toLowerCase(),
        name: data.name.trim(),
        department: data.department.trim(),
        designation: data.designation.trim(),
        reportsToEmployeeId: data.reportsToEmployeeId?.trim() || null,
        bankAccountRef: data.bankAccountRef?.trim() || null,
        employmentStatus: data.employmentStatus || 'active'
      }
    });

    await AuditService.log({
      actorId: adminUserId,
      actionType: 'EMPLOYEE_MASTER_CREATED',
      recordType: 'EmployeeMaster',
      recordId: employee.id,
      newValue: { employeeId: employee.employeeId, email: employee.officialEmail },
      ipAddress
    });

    return employee;
  }

  // Bulk import via CSV (Prompt Section 4)
  static async importEmployeesCsv(adminUserId: string, csvContent: string, ipAddress?: string) {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
      throw new AppError(400, 'CSV file has no data rows', 'EMPTY_CSV');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['employeeid', 'officialemail', 'name', 'department', 'designation'];
    for (const h of expectedHeaders) {
      if (!headers.includes(h)) {
        throw new AppError(400, `Missing required CSV column: ${h}`, 'INVALID_CSV_HEADERS');
      }
    }

    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = parts[idx] || '';
      });

      if (!row['employeeid'] || !row['officialemail'] || !row['name']) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: missing mandatory fields`);
        continue;
      }

      try {
        const existing = await prisma.employeeMaster.findFirst({
          where: {
            OR: [
              { employeeId: row['employeeid'] },
              { officialEmail: row['officialemail'].toLowerCase() }
            ]
          }
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.employeeMaster.create({
          data: {
            employeeId: row['employeeid'],
            officialEmail: row['officialemail'].toLowerCase(),
            name: row['name'],
            department: row['department'] || 'General',
            designation: row['designation'] || 'Staff',
            reportsToEmployeeId: row['reportstoemployeeid'] || null,
            bankAccountRef: row['bankaccountref'] || null,
            employmentStatus: row['employmentstatus'] || 'active'
          }
        });
        results.imported++;
      } catch (err: any) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    await AuditService.log({
      actorId: adminUserId,
      actionType: 'EMPLOYEES_BULK_IMPORTED',
      recordType: 'EmployeeMaster',
      newValue: results,
      ipAddress
    });

    return results;
  }

  // 2. User Account Management (BR-1, FR-ROLE-01..04)
  static async listUsers() {
    return await prisma.user.findMany({
      include: {
        employeeMaster: true,
        roles: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Create User only from existing master row (BR-1)
  static async createUserFromMaster(
    adminUserId: string,
    employeeId: string,
    roles: string[],
    ipAddress?: string
  ) {
    const master = await prisma.employeeMaster.findUnique({
      where: { employeeId: employeeId.trim() },
      include: { user: true }
    });

    if (!master) {
      throw new AppError(404, 'Employee record not found in Employee Master (BR-1)', 'MASTER_NOT_FOUND');
    }

    if (master.user) {
      throw new AppError(400, 'User account already exists for this employee', 'USER_ALREADY_EXISTS');
    }

    const defaultPasswordHash = '$2b$10$wO3a9n8m7gQz6Z7gH1v7ueXb9r712345678901234567890123456'; // placeholder until activated

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          employeeMasterId: master.id,
          passwordHash: defaultPasswordHash,
          activated: false
        }
      });

      for (const role of roles) {
        await tx.userRole.create({
          data: { userId: user.id, role }
        });
      }

      await AuditService.log({
        actorId: adminUserId,
        actionType: 'USER_ACCOUNT_CREATED',
        recordType: 'User',
        recordId: user.id,
        newValue: { employeeId: master.employeeId, roles },
        ipAddress
      }, tx);

      return user;
    });
  }

  // Update roles (FR-ROLE-01)
  static async updateUserRoles(adminUserId: string, targetUserId: string, roles: string[], ipAddress?: string) {
    return await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      for (const role of roles) {
        await tx.userRole.create({
          data: { userId: targetUserId, role }
        });
      }

      await AuditService.log({
        actorId: adminUserId,
        actionType: 'USER_ROLES_UPDATED',
        recordType: 'User',
        recordId: targetUserId,
        newValue: { roles },
        ipAddress
      }, tx);

      return { success: true };
    });
  }

  // Deactivate user account (FR-ROLE-03, FR-ROLE-04, BR-1)
  // "Deactivate, never delete; pending approval items must be reassigned first."
  static async deactivateUser(adminUserId: string, targetUserId: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { employeeMaster: true }
    });

    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

    // Check if user has pending approval items assigned to them
    const pendingApprovalsCount = await prisma.approval.count({
      where: { approverId: targetUserId, decision: 'PENDING' }
    });

    if (pendingApprovalsCount > 0) {
      throw new AppError(
        400,
        `Cannot deactivate user. User has ${pendingApprovalsCount} pending approval task(s) that must be reassigned first (FR-ADMIN-04).`,
        'PENDING_APPROVALS_EXIST'
      );
    }

    return await prisma.$transaction(async (tx) => {
      // Set master status to terminated/inactive
      await tx.employeeMaster.update({
        where: { id: user.employeeMasterId },
        data: { employmentStatus: 'terminated' }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { activated: false }
      });

      await AuditService.log({
        actorId: adminUserId,
        actionType: 'USER_DEACTIVATED',
        recordType: 'User',
        recordId: user.id,
        priorValue: { status: user.employeeMaster.employmentStatus },
        newValue: { status: 'terminated' },
        ipAddress
      }, tx);

      return { success: true, message: 'User account deactivated.' };
    });
  }

  // Reassign Employee designated Approving Manager (FR-ROLE-02)
  static async reassignManager(
    adminUserId: string,
    targetUserId: string,
    newManagerEmployeeId: string,
    ipAddress?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { employeeMaster: true }
    });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

    const newMgr = await prisma.employeeMaster.findUnique({
      where: { employeeId: newManagerEmployeeId.trim() },
      include: { user: true }
    });

    if (!newMgr || newMgr.employmentStatus !== 'active') {
      throw new AppError(400, 'New designated manager must be an active employee in Employee Master', 'INVALID_MANAGER');
    }

    const priorMgr = user.employeeMaster.reportsToEmployeeId;

    return await prisma.$transaction(async (tx) => {
      await tx.employeeMaster.update({
        where: { id: user.employeeMasterId },
        data: { reportsToEmployeeId: newMgr.employeeId }
      });

      await AuditService.log({
        actorId: adminUserId,
        actionType: 'MANAGER_REASSIGNED',
        recordType: 'EmployeeMaster',
        recordId: user.employeeMasterId,
        priorValue: { reportsToEmployeeId: priorMgr },
        newValue: { reportsToEmployeeId: newMgr.employeeId },
        ipAddress
      }, tx);

      return { success: true };
    });
  }

  // Reassign pending approval task (FR-ADMIN-04)
  static async reassignPendingApproval(
    adminUserId: string,
    approvalId: string,
    newApproverUserId: string,
    ipAddress?: string
  ) {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId }
    });

    if (!approval || approval.decision !== 'PENDING') {
      throw new AppError(404, 'Pending approval task not found', 'NOT_FOUND');
    }

    const newApprover = await prisma.user.findUnique({
      where: { id: newApproverUserId },
      include: { employeeMaster: true }
    });

    if (!newApprover || newApprover.employeeMaster.employmentStatus !== 'active') {
      throw new AppError(400, 'New approver must be an active employee', 'INVALID_APPROVER');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.approval.update({
        where: { id: approvalId },
        data: { approverId: newApproverUserId }
      });

      if (approval.entityType === 'TRAVEL_REQUEST') {
        await tx.travelRequest.update({
          where: { id: approval.entityId },
          data: { currentApproverId: newApproverUserId }
        });
      } else {
        await tx.expenseClaim.update({
          where: { id: approval.entityId },
          data: { currentApproverId: newApproverUserId }
        });
      }

      await AuditService.log({
        actorId: adminUserId,
        actionType: 'APPROVAL_REASSIGNED',
        recordType: 'Approval',
        recordId: approval.id,
        priorValue: { approverId: approval.approverId },
        newValue: { approverId: newApproverUserId },
        ipAddress
      }, tx);

      return updated;
    });
  }

  // Manual Escalation Job (Prompt Section 5, FR-ADMIN-04)
  // "Run escalation job (items pending > 3 business days -> escalate to approver's manager)"
  static async runEscalationJob(adminUserId: string, ipAddress?: string) {
    const slaDays = await SettingService.getNumber('slaDays') || 3;
    const now = new Date();

    const pendingApprovals = await prisma.approval.findMany({
      where: { decision: 'PENDING' },
      include: { approver: { include: { employeeMaster: true } } }
    });

    const escalated = [];

    for (const app of pendingApprovals) {
      const daysPending = getBusinessDaysBetween(app.createdAt, now);
      if (daysPending >= slaDays) {
        // Find approver's manager
        const approverMaster = app.approver.employeeMaster;
        if (approverMaster.reportsToEmployeeId) {
          const mgrMaster = await prisma.employeeMaster.findUnique({
            where: { employeeId: approverMaster.reportsToEmployeeId },
            include: { user: true }
          });

          if (mgrMaster?.user && mgrMaster.employmentStatus === 'active') {
            await prisma.$transaction(async (tx) => {
              await tx.approval.update({
                where: { id: app.id },
                data: { approverId: mgrMaster.user!.id }
              });

              if (app.entityType === 'TRAVEL_REQUEST') {
                await tx.travelRequest.update({
                  where: { id: app.entityId },
                  data: { currentApproverId: mgrMaster.user!.id }
                });
              } else {
                await tx.expenseClaim.update({
                  where: { id: app.entityId },
                  data: { currentApproverId: mgrMaster.user!.id }
                });
              }

              await NotificationService.notify({
                userId: mgrMaster.user!.id,
                recipientEmail: mgrMaster.officialEmail,
                title: `Escalated Approval Task: SLA Exceeded`,
                message: `Task #${app.entityId} was escalated to you because it was pending > ${slaDays} business days with ${approverMaster.name}.`
              }, tx);
            });

            escalated.push({ approvalId: app.id, escalatedTo: mgrMaster.name });
          }
        }
      }
    }

    await AuditService.log({
      actorId: adminUserId,
      actionType: 'ESCALATION_JOB_EXECUTED',
      recordType: 'System',
      newValue: { escalatedCount: escalated.length, escalated },
      ipAddress
    });

    return { escalatedCount: escalated.length, details: escalated };
  }

  // 3. Policy Rules CRUD with Versioning (FR-ADMIN-01..02)
  static async listPolicies() {
    return await prisma.policyRule.findMany({
      orderBy: [{ version: 'desc' }, { category: 'asc' }]
    });
  }

  static async createPolicyRule(
    adminUserId: string,
    data: {
      category: string;
      limitAmountPaise: number;
      receiptThresholdPaise: number;
      noticePeriodDays?: number;
    },
    ipAddress?: string
  ) {
    // Find latest version number
    const latest = await prisma.policyRule.findFirst({
      orderBy: { version: 'desc' }
    });
    const newVersion = (latest?.version || 1) + 1;

    // Deactivate previous active rule for the same category
    await prisma.policyRule.updateMany({
      where: { category: data.category.trim(), active: true },
      data: { active: false }
    });

    const rule = await prisma.policyRule.create({
      data: {
        version: newVersion,
        category: data.category.trim(),
        limitAmountPaise: data.limitAmountPaise,
        receiptThresholdPaise: data.receiptThresholdPaise,
        noticePeriodDays: data.noticePeriodDays || 5,
        active: true
      }
    });

    await AuditService.log({
      actorId: adminUserId,
      actionType: 'POLICY_RULE_CREATED',
      recordType: 'PolicyRule',
      recordId: rule.id,
      newValue: { category: rule.category, version: rule.version, limitPaise: rule.limitAmountPaise },
      ipAddress
    });

    return rule;
  }

  static async deactivatePolicyRule(adminUserId: string, ruleId: string, ipAddress?: string) {
    const rule = await prisma.policyRule.update({
      where: { id: ruleId },
      data: { active: false }
    });

    await AuditService.log({
      actorId: adminUserId,
      actionType: 'POLICY_RULE_DEACTIVATED',
      recordType: 'PolicyRule',
      recordId: rule.id,
      ipAddress
    });

    return rule;
  }
}
