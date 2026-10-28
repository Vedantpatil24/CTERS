import { prisma } from '../prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { SettingService } from './setting.service';
import { TRAVEL_STATUS, CLAIM_STATUS, ROLES } from '../constants';

export class ApprovalService {
  // Central decision workflow for both Travel and Expense Claims (FR-APPR-01..07, BR-03)
  static async decide(
    approverId: string,
    input: {
      entityType: 'TRAVEL_REQUEST' | 'EXPENSE_CLAIM';
      entityId: string;
      decision: 'APPROVE' | 'REJECT' | 'CLARIFY';
      comment?: string;
    },
    ipAddress?: string
  ) {
    const { entityType, entityId, decision, comment } = input;
    const cleanComment = (comment || '').trim();

    // Check mandatory comment conditions (reject, clarify)
    if ((decision === 'REJECT' || decision === 'CLARIFY') && cleanComment.length === 0) {
      throw new AppError(400, `Comment is mandatory when decision is ${decision} (FR-APPR-03, FR-APPR-04)`, 'COMMENT_REQUIRED');
    }

    // Retrieve active approver details
    const approverUser = await prisma.user.findUnique({
      where: { id: approverId },
      include: { employeeMaster: true, roles: true }
    });
    if (!approverUser) throw new AppError(404, 'Approver not found', 'NOT_FOUND');

    const isAdmin = approverUser.roles.some(r => r.role === ROLES.ADMIN);

    if (entityType === 'TRAVEL_REQUEST') {
      return await this.decideTravelRequest(approverUser, isAdmin, entityId, decision, cleanComment, ipAddress);
    } else {
      return await this.decideExpenseClaim(approverUser, isAdmin, entityId, decision, cleanComment, ipAddress);
    }
  }

  // Handle Travel Request Approval
  private static async decideTravelRequest(
    approverUser: any,
    isAdmin: boolean,
    requestId: string,
    decision: 'APPROVE' | 'REJECT' | 'CLARIFY',
    comment: string,
    ipAddress?: string
  ) {
    const req = await prisma.travelRequest.findUnique({
      where: { id: requestId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!req) throw new AppError(404, 'Travel request not found', 'NOT_FOUND');

    // Rule: Block self-approval (BR-03)
    if (req.userId === approverUser.id) {
      throw new AppError(403, 'Approving your own travel request is strictly prohibited (BR-03, FR-APPR-01)', 'SELF_APPROVAL_BLOCKED');
    }

    // Rule: Only designated approver or Admin
    if (req.currentApproverId !== approverUser.id && !isAdmin) {
      throw new AppError(403, 'You are not the designated approver for this travel request', 'NOT_DESIGNATED_APPROVER');
    }

    // Check current pending approval record
    const pendingApproval = await prisma.approval.findFirst({
      where: {
        entityType: 'TRAVEL_REQUEST',
        entityId: req.id,
        decision: 'PENDING'
      },
      orderBy: { level: 'desc' }
    });

    const currentLevel = pendingApproval?.level || 1;
    const secondLevelThreshold = await SettingService.getNumber('secondLevelTravelPaise') || 5000000; // ₹50,000

    return await prisma.$transaction(async (tx) => {
      // 1. If REJECT
      if (decision === 'REJECT') {
        const updated = await tx.travelRequest.update({
          where: { id: req.id },
          data: { status: TRAVEL_STATUS.REJECTED }
        });

        if (pendingApproval) {
          await tx.approval.update({
            where: { id: pendingApproval.id },
            data: { decision: 'REJECT', comment, decidedAt: new Date(), approverId: approverUser.id }
          });
        }

        await AuditService.log({
          actorId: approverUser.id,
          actorEmail: approverUser.employeeMaster.officialEmail,
          actionType: 'TRAVEL_REQUEST_REJECTED',
          recordType: 'TravelRequest',
          recordId: req.id,
          priorValue: { status: req.status },
          newValue: { status: TRAVEL_STATUS.REJECTED, comment },
          ipAddress
        }, tx);

        await NotificationService.notify({
          userId: req.userId,
          recipientEmail: req.user.employeeMaster.officialEmail,
          title: `Travel Request ${req.requestNo} Rejected`,
          message: `Your travel request was rejected by ${approverUser.employeeMaster.name}. Reason: ${comment}`
        }, tx);

        return updated;
      }

      // 2. If CLARIFY
      if (decision === 'CLARIFY') {
        const updated = await tx.travelRequest.update({
          where: { id: req.id },
          data: { status: TRAVEL_STATUS.CLARIFICATION_REQUESTED }
        });

        if (pendingApproval) {
          await tx.approval.update({
            where: { id: pendingApproval.id },
            data: { decision: 'CLARIFY', comment, decidedAt: new Date(), approverId: approverUser.id }
          });
        }

        await AuditService.log({
          actorId: approverUser.id,
          actorEmail: approverUser.employeeMaster.officialEmail,
          actionType: 'TRAVEL_REQUEST_CLARIFICATION_REQUESTED',
          recordType: 'TravelRequest',
          recordId: req.id,
          priorValue: { status: req.status },
          newValue: { status: TRAVEL_STATUS.CLARIFICATION_REQUESTED, comment },
          ipAddress
        }, tx);

        await NotificationService.notify({
          userId: req.userId,
          recipientEmail: req.user.employeeMaster.officialEmail,
          title: `Clarification Requested: Travel Request ${req.requestNo}`,
          message: `${approverUser.employeeMaster.name} requested clarification: ${comment}`
        }, tx);

        return updated;
      }

      // 3. If APPROVE
      // Check if requires Level 2 approval
      if (currentLevel === 1 && req.estimatedBudgetPaise > secondLevelThreshold) {
        // Find approver's manager
        let nextApprover: any = null;
        if (approverUser.employeeMaster.reportsToEmployeeId) {
          const m = await tx.employeeMaster.findUnique({
            where: { employeeId: approverUser.employeeMaster.reportsToEmployeeId },
            include: { user: true }
          });
          if (m?.user && m.employmentStatus === 'active') {
            nextApprover = m.user;
          }
        }

        if (nextApprover && nextApprover.id !== approverUser.id && nextApprover.id !== req.userId) {
          // Complete Level 1
          if (pendingApproval) {
            await tx.approval.update({
              where: { id: pendingApproval.id },
              data: { decision: 'APPROVE', comment: comment || 'Level 1 Approved', decidedAt: new Date(), approverId: approverUser.id }
            });
          }

          // Create Level 2 approval record
          await tx.approval.create({
            data: {
              entityType: 'TRAVEL_REQUEST',
              entityId: req.id,
              level: 2,
              approverId: nextApprover.id,
              decision: 'PENDING'
            }
          });

          // Update current approver
          await tx.travelRequest.update({
            where: { id: req.id },
            data: { currentApproverId: nextApprover.id }
          });

          await NotificationService.notify({
            userId: nextApprover.id,
            recipientEmail: nextApprover.employeeMaster?.officialEmail,
            title: `Level 2 Approval Required: Travel Request ${req.requestNo}`,
            message: `High-value travel request (${req.requestNo}) approved by ${approverUser.employeeMaster.name} requires your Level 2 approval.`
          }, tx);

          return { message: 'Level 1 approved. High-value request escalated to Level 2 approver.' };
        }
      }

      // Final Approval reached!
      const updated = await tx.travelRequest.update({
        where: { id: req.id },
        data: { status: TRAVEL_STATUS.APPROVED, currentApproverId: null }
      });

      if (pendingApproval) {
        await tx.approval.update({
          where: { id: pendingApproval.id },
          data: { decision: 'APPROVE', comment: comment || 'Approved', decidedAt: new Date(), approverId: approverUser.id }
        });
      }

      await AuditService.log({
        actorId: approverUser.id,
        actorEmail: approverUser.employeeMaster.officialEmail,
        actionType: 'TRAVEL_REQUEST_APPROVED',
        recordType: 'TravelRequest',
        recordId: req.id,
        priorValue: { status: req.status },
        newValue: { status: TRAVEL_STATUS.APPROVED, comment },
        ipAddress
      }, tx);

      // Notify employee
      await NotificationService.notify({
        userId: req.userId,
        recipientEmail: req.user.employeeMaster.officialEmail,
        title: `Travel Request ${req.requestNo} Approved`,
        message: `Your travel request has been approved! It will now be processed by the Travel Desk.`
      }, tx);

      // Notify Travel Desk (FR-BOOK-01)
      const travelDeskUsers = await tx.userRole.findMany({
        where: { role: ROLES.TRAVEL_DESK },
        include: { user: { include: { employeeMaster: true } } }
      });
      for (const td of travelDeskUsers) {
        await NotificationService.notify({
          userId: td.userId,
          recipientEmail: td.user.employeeMaster.officialEmail,
          title: `New Booking Required: Travel Request ${req.requestNo}`,
          message: `Approved travel request for ${req.user.employeeMaster.name} is ready for booking.`
        }, tx);
      }

      return updated;
    });
  }

  // Handle Expense Claim Approval
  private static async decideExpenseClaim(
    approverUser: any,
    isAdmin: boolean,
    claimId: string,
    decision: 'APPROVE' | 'REJECT' | 'CLARIFY',
    comment: string,
    ipAddress?: string
  ) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: {
        user: { include: { employeeMaster: true } },
        violations: true
      }
    });

    if (!claim) throw new AppError(404, 'Expense claim not found', 'NOT_FOUND');

    // Rule: Block self-approval
    if (claim.userId === approverUser.id) {
      throw new AppError(403, 'Approving your own expense claim is strictly prohibited (BR-03, FR-APPR-01)', 'SELF_APPROVAL_BLOCKED');
    }

    // Rule: Designated approver or Admin
    if (claim.currentApproverId !== approverUser.id && !isAdmin) {
      throw new AppError(403, 'You are not the designated approver for this expense claim', 'NOT_DESIGNATED_APPROVER');
    }

    // Rule: If non-blocking policy violations exist and decision is APPROVE, comment is mandatory (FR-POLICY-07)
    const hasFlags = claim.violations.length > 0;
    if (decision === 'APPROVE' && hasFlags && comment.length === 0) {
      throw new AppError(400, 'Justification comment is mandatory when approving a claim with policy violations (FR-POLICY-07)', 'OVERRIDE_JUSTIFICATION_REQUIRED');
    }

    const pendingApproval = await prisma.approval.findFirst({
      where: {
        entityType: 'EXPENSE_CLAIM',
        entityId: claim.id,
        decision: 'PENDING'
      },
      orderBy: { level: 'desc' }
    });

    const currentLevel = pendingApproval?.level || 1;
    const secondLevelThreshold = await SettingService.getNumber('secondLevelClaimPaise') || 2500000; // ₹25,000

    return await prisma.$transaction(async (tx) => {
      // 1. REJECT
      if (decision === 'REJECT') {
        const updated = await tx.expenseClaim.update({
          where: { id: claim.id },
          data: { status: CLAIM_STATUS.REJECTED }
        });

        if (pendingApproval) {
          await tx.approval.update({
            where: { id: pendingApproval.id },
            data: { decision: 'REJECT', comment, decidedAt: new Date(), approverId: approverUser.id }
          });
        }

        await AuditService.log({
          actorId: approverUser.id,
          actorEmail: approverUser.employeeMaster.officialEmail,
          actionType: 'EXPENSE_CLAIM_REJECTED',
          recordType: 'ExpenseClaim',
          recordId: claim.id,
          priorValue: { status: claim.status },
          newValue: { status: CLAIM_STATUS.REJECTED, comment },
          ipAddress
        }, tx);

        await NotificationService.notify({
          userId: claim.userId,
          recipientEmail: claim.user.employeeMaster.officialEmail,
          title: `Expense Claim ${claim.claimNo} Rejected`,
          message: `Your claim was rejected by ${approverUser.employeeMaster.name}. Reason: ${comment}`
        }, tx);

        return updated;
      }

      // 2. CLARIFY
      if (decision === 'CLARIFY') {
        const updated = await tx.expenseClaim.update({
          where: { id: claim.id },
          data: { status: CLAIM_STATUS.CLARIFICATION_REQUESTED }
        });

        if (pendingApproval) {
          await tx.approval.update({
            where: { id: pendingApproval.id },
            data: { decision: 'CLARIFY', comment, decidedAt: new Date(), approverId: approverUser.id }
          });
        }

        await AuditService.log({
          actorId: approverUser.id,
          actorEmail: approverUser.employeeMaster.officialEmail,
          actionType: 'EXPENSE_CLAIM_CLARIFICATION_REQUESTED',
          recordType: 'ExpenseClaim',
          recordId: claim.id,
          priorValue: { status: claim.status },
          newValue: { status: CLAIM_STATUS.CLARIFICATION_REQUESTED, comment },
          ipAddress
        }, tx);

        await NotificationService.notify({
          userId: claim.userId,
          recipientEmail: claim.user.employeeMaster.officialEmail,
          title: `Clarification Requested: Claim ${claim.claimNo}`,
          message: `${approverUser.employeeMaster.name} requested clarification: ${comment}`
        }, tx);

        return updated;
      }

      // 3. APPROVE
      // Check Level 2 threshold
      if (currentLevel === 1 && claim.totalAmountPaise > secondLevelThreshold) {
        let nextApprover: any = null;
        if (approverUser.employeeMaster.reportsToEmployeeId) {
          const m = await tx.employeeMaster.findUnique({
            where: { employeeId: approverUser.employeeMaster.reportsToEmployeeId },
            include: { user: true }
          });
          if (m?.user && m.employmentStatus === 'active') {
            nextApprover = m.user;
          }
        }

        if (nextApprover && nextApprover.id !== approverUser.id && nextApprover.id !== claim.userId) {
          if (pendingApproval) {
            await tx.approval.update({
              where: { id: pendingApproval.id },
              data: { decision: 'APPROVE', comment: comment || 'Level 1 Approved', decidedAt: new Date(), approverId: approverUser.id }
            });
          }

          await tx.approval.create({
            data: {
              entityType: 'EXPENSE_CLAIM',
              entityId: claim.id,
              level: 2,
              approverId: nextApprover.id,
              decision: 'PENDING'
            }
          });

          await tx.expenseClaim.update({
            where: { id: claim.id },
            data: { currentApproverId: nextApprover.id }
          });

          await NotificationService.notify({
            userId: nextApprover.id,
            recipientEmail: nextApprover.employeeMaster?.officialEmail,
            title: `Level 2 Approval Required: Claim ${claim.claimNo}`,
            message: `High-value expense claim (${claim.claimNo}) approved by ${approverUser.employeeMaster.name} requires your Level 2 approval.`
          }, tx);

          return { message: 'Level 1 approved. High-value claim escalated to Level 2 approver.' };
        }
      }

      // Final Approval
      const updated = await tx.expenseClaim.update({
        where: { id: claim.id },
        data: { status: CLAIM_STATUS.APPROVED, currentApproverId: null }
      });

      if (pendingApproval) {
        await tx.approval.update({
          where: { id: pendingApproval.id },
          data: { decision: 'APPROVE', comment: comment || 'Approved', decidedAt: new Date(), approverId: approverUser.id }
        });
      }

      await AuditService.log({
        actorId: approverUser.id,
        actorEmail: approverUser.employeeMaster.officialEmail,
        actionType: 'EXPENSE_CLAIM_APPROVED',
        recordType: 'ExpenseClaim',
        recordId: claim.id,
        priorValue: { status: claim.status },
        newValue: { status: CLAIM_STATUS.APPROVED, comment },
        ipAddress
      }, tx);

      // Notify employee
      await NotificationService.notify({
        userId: claim.userId,
        recipientEmail: claim.user.employeeMaster.officialEmail,
        title: `Expense Claim ${claim.claimNo} Approved`,
        message: `Your claim has been approved by management and forwarded to Finance for verification.`
      }, tx);

      // Notify Finance Team (FR-REIMB-01)
      const financeUsers = await tx.userRole.findMany({
        where: { role: ROLES.FINANCE },
        include: { user: { include: { employeeMaster: true } } }
      });
      for (const fin of financeUsers) {
        await NotificationService.notify({
          userId: fin.userId,
          recipientEmail: fin.user.employeeMaster.officialEmail,
          title: `New Claim Ready for Verification: ${claim.claimNo}`,
          message: `Approved claim #${claim.claimNo} (₹${(claim.totalAmountPaise / 100).toFixed(2)}) is awaiting finance verification.`
        }, tx);
      }

      return updated;
    });
  }

  // List Pending Approvals for a Manager
  static async listPendingApprovals(approverId: string) {
    const approvals = await prisma.approval.findMany({
      where: {
        approverId,
        decision: 'PENDING'
      },
      orderBy: { createdAt: 'asc' } // Sorted by submission date (FR-APPR-06)
    });

    const results = [];
    for (const a of approvals) {
      if (a.entityType === 'TRAVEL_REQUEST') {
        const item = await prisma.travelRequest.findUnique({
          where: { id: a.entityId },
          include: { user: { include: { employeeMaster: true } } }
        });
        if (item) results.push({ approval: a, type: 'TRAVEL_REQUEST', item });
      } else {
        const item = await prisma.expenseClaim.findUnique({
          where: { id: a.entityId },
          include: {
            user: { include: { employeeMaster: true } },
            lines: { include: { receipts: true } },
            violations: true
          }
        });
        if (item) results.push({ approval: a, type: 'EXPENSE_CLAIM', item });
      }
    }

    return results;
  }
}
