import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { PolicyService } from './policy.service';
import { CLAIM_STATUS, TRAVEL_STATUS, ALLOWED_CLAIM_TRANSITIONS, ROLES } from '../constants';

// Helper to verify magic bytes for JPEG, PNG, PDF (FR-RCPT-05)
export function verifyMagicBytes(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // PDF: 25 50 44 46 (%PDF)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;

    return false;
  } catch (err) {
    return false;
  }
}

export class ClaimService {
  // Create draft claim (FR-CLAIM-01, FR-CLAIM-04, BR-2, BR-3)
  static async createClaimDraft(
    userId: string,
    travelRequestId: string,
    description?: string,
    ipAddress?: string
  ) {
    const travelReq = await prisma.travelRequest.findUnique({
      where: { id: travelRequestId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!travelReq) throw new AppError(404, 'Travel request not found', 'NOT_FOUND');
    if (travelReq.userId !== userId) throw new AppError(403, 'You can only claim for your own travel request', 'FORBIDDEN');

    // Rule: Claim allowed only on booked or completed travel (BR-2, Section 3)
    if (travelReq.status !== TRAVEL_STATUS.BOOKED && travelReq.status !== TRAVEL_STATUS.COMPLETED) {
      throw new AppError(
        400,
        `Expense claims are only allowed against 'booked' or 'completed' travel requests. Current status: ${travelReq.status} (BR-2)`,
        'INVALID_TRAVEL_STATE'
      );
    }

    const count = await prisma.expenseClaim.count();
    const claimNo = `CLM-${String(count + 1).padStart(5, '0')}`;

    const claim = await prisma.$transaction(async (tx) => {
      const c = await tx.expenseClaim.create({
        data: {
          claimNo,
          travelRequestId,
          userId,
          description,
          status: CLAIM_STATUS.DRAFT,
          totalAmountPaise: 0
        }
      });

      await AuditService.log({
        actorId: userId,
        actorEmail: travelReq.user.employeeMaster.officialEmail,
        actionType: 'CLAIM_DRAFT_CREATED',
        recordType: 'ExpenseClaim',
        recordId: c.id,
        newValue: { claimNo, travelRequestId },
        ipAddress
      }, tx);

      return c;
    });

    return claim;
  }

  // Add line to claim (FR-CLAIM-02, FR-CLAIM-03)
  static async addLine(
    claimId: string,
    userId: string,
    lineData: {
      category: string;
      date: string;
      amountPaise: number;
      description?: string;
    }
  ) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId }
    });

    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.userId !== userId) throw new AppError(403, 'Unauthorized', 'FORBIDDEN');
    if (claim.status !== CLAIM_STATUS.DRAFT && claim.status !== CLAIM_STATUS.CLARIFICATION_REQUESTED) {
      throw new AppError(400, 'Expense lines can only be modified while claim is in Draft or Clarification Requested', 'CANNOT_MODIFY');
    }

    return await prisma.$transaction(async (tx) => {
      const line = await tx.expenseLine.create({
        data: {
          claimId,
          category: lineData.category,
          date: new Date(lineData.date),
          amountPaise: lineData.amountPaise,
          convertedAmountPaise: lineData.amountPaise,
          description: lineData.description
        }
      });

      // Recalculate claim total automatically (FR-CLAIM-03)
      const allLines = await tx.expenseLine.findMany({ where: { claimId } });
      const newTotal = allLines.reduce((sum, l) => sum + l.amountPaise, 0);

      await tx.expenseClaim.update({
        where: { id: claimId },
        data: { totalAmountPaise: newTotal }
      });

      return line;
    });
  }

  // Delete line from claim
  static async removeLine(claimId: string, lineId: string, userId: string) {
    const claim = await prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.userId !== userId) throw new AppError(403, 'Unauthorized', 'FORBIDDEN');
    if (claim.status !== CLAIM_STATUS.DRAFT && claim.status !== CLAIM_STATUS.CLARIFICATION_REQUESTED) {
      throw new AppError(400, 'Cannot remove lines from submitted claim', 'CANNOT_MODIFY');
    }

    return await prisma.$transaction(async (tx) => {
      await tx.expenseLine.delete({ where: { id: lineId } });

      const allLines = await tx.expenseLine.findMany({ where: { claimId } });
      const newTotal = allLines.reduce((sum, l) => sum + l.amountPaise, 0);

      await tx.expenseClaim.update({
        where: { id: claimId },
        data: { totalAmountPaise: newTotal }
      });

      return { success: true };
    });
  }

  // Attach receipt to an expense line (FR-RCPT-01, FR-RCPT-02, FR-RCPT-05)
  static async addReceipt(
    claimId: string,
    lineId: string,
    userId: string,
    file: {
      path: string;
      originalname: string;
      mimetype: string;
      size: number;
    }
  ) {
    const claim = await prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.userId !== userId) throw new AppError(403, 'Unauthorized', 'FORBIDDEN');
    if (claim.status !== CLAIM_STATUS.DRAFT && claim.status !== CLAIM_STATUS.CLARIFICATION_REQUESTED) {
      throw new AppError(400, 'Receipts cannot be added after claim submission (FR-RCPT-02)', 'CANNOT_MODIFY');
    }

    // Check file size <= 5 MB (5 * 1024 * 1024 = 5242880 bytes)
    if (file.size > 5242880) {
      fs.unlinkSync(file.path);
      throw new AppError(400, 'Receipt file exceeds maximum size limit of 5 MB (FR-RCPT-05)', 'FILE_TOO_LARGE');
    }

    // Check magic bytes (FR-RCPT-05)
    if (!verifyMagicBytes(file.path)) {
      fs.unlinkSync(file.path);
      throw new AppError(400, 'Invalid file format. Only valid JPEG, PNG, or PDF files are accepted (FR-RCPT-05)', 'INVALID_FILE_TYPE');
    }

    // Check maximum 5 receipts per line (Section 3)
    const existingCount = await prisma.receipt.count({ where: { lineId } });
    if (existingCount >= 5) {
      fs.unlinkSync(file.path);
      throw new AppError(400, 'Maximum of 5 receipts allowed per expense item (FR-RCPT-01)', 'MAX_RECEIPTS_EXCEEDED');
    }

    const receipt = await prisma.receipt.create({
      data: {
        lineId,
        fileName: file.originalname,
        fileUrl: file.path,
        fileType: file.mimetype,
        fileSizeBytes: file.size
      }
    });

    return receipt;
  }

  // Remove receipt (FR-RCPT-02)
  static async removeReceipt(claimId: string, receiptId: string, userId: string) {
    const claim = await prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.userId !== userId) throw new AppError(403, 'Unauthorized', 'FORBIDDEN');
    if (claim.status !== CLAIM_STATUS.DRAFT && claim.status !== CLAIM_STATUS.CLARIFICATION_REQUESTED) {
      throw new AppError(400, 'Receipts cannot be removed after claim submission (FR-RCPT-02)', 'CANNOT_MODIFY');
    }

    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!receipt) throw new AppError(404, 'Receipt not found', 'NOT_FOUND');

    if (fs.existsSync(receipt.fileUrl)) {
      fs.unlinkSync(receipt.fileUrl);
    }

    await prisma.receipt.delete({ where: { id: receiptId } });
    return { success: true };
  }

  // Dry-run policy validation (POST /claims/:id/validate)
  static async validateClaimDryRun(claimId: string, userId: string) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: { lines: { include: { receipts: true } } }
    });
    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.userId !== userId) throw new AppError(403, 'Unauthorized', 'FORBIDDEN');

    return await PolicyService.evaluateClaim(claimId);
  }

  // Final Submit Claim (FR-CLAIM-05, FR-CLAIM-06, FR-POLICY-04, FR-APPR-01)
  static async submitClaim(claimId: string, userId: string, ipAddress?: string) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: {
        lines: { include: { receipts: true } },
        travelRequest: { include: { user: { include: { employeeMaster: true } } } }
      }
    });

    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.userId !== userId) throw new AppError(403, 'Unauthorized', 'FORBIDDEN');

    // Rule: zero lines cannot submit (FR-CLAIM-06)
    if (claim.lines.length === 0) {
      throw new AppError(400, 'Cannot submit an expense claim with zero items (FR-CLAIM-06)', 'EMPTY_CLAIM');
    }

    // Run policy engine
    const { violations, hasBlocking, activeVersion } = await PolicyService.evaluateClaim(claimId);

    // Rule: Any blocking violation (e.g. missing required receipt) blocks submission!
    // "Any failure -> stays draft"
    if (hasBlocking) {
      throw new AppError(
        422,
        'Claim submission blocked due to policy violations (e.g. missing required receipts). Please attach receipts and try again.',
        'POLICY_VIOLATION_BLOCKING',
        violations.filter(v => v.blocking).map(v => ({ field: v.category, message: v.description }))
      );
    }

    // Determine approver (Employee's reporting manager)
    const empMaster = claim.travelRequest.user.employeeMaster;
    let managerUser: any = null;

    if (empMaster.reportsToEmployeeId) {
      const mgrMaster = await prisma.employeeMaster.findUnique({
        where: { employeeId: empMaster.reportsToEmployeeId },
        include: { user: true }
      });
      if (mgrMaster?.user && mgrMaster.employmentStatus === 'active') {
        managerUser = mgrMaster.user;
      }
    }

    // Fallback if no reporting manager assigned: route to admin
    if (!managerUser) {
      const adminRole = await prisma.userRole.findFirst({
        where: { role: ROLES.ADMIN },
        include: { user: { include: { employeeMaster: true } } }
      });
      if (adminRole?.user) managerUser = adminRole.user;
    }

    if (!managerUser) {
      throw new AppError(400, 'No active approving manager could be resolved.', 'NO_APPROVER');
    }

    // Execute submission in transaction
    return await prisma.$transaction(async (tx) => {
      // Clear previous violations
      await tx.policyViolation.deleteMany({ where: { claimId } });

      // Persist newly evaluated policy violations (even non-blocking ones)
      for (const v of violations) {
        await tx.policyViolation.create({
          data: {
            claimId,
            lineId: v.lineId,
            ruleVersion: v.ruleVersion,
            category: v.category,
            description: v.description,
            blocking: v.blocking
          }
        });
      }

      // Update claim status to pending_approval and record snapshot of policyVersionUsed
      const updated = await tx.expenseClaim.update({
        where: { id: claimId },
        data: {
          status: CLAIM_STATUS.PENDING_APPROVAL,
          policyVersionUsed: activeVersion,
          currentApproverId: managerUser.id,
          submittedAt: new Date()
        }
      });

      // Create level 1 Approval record
      await tx.approval.create({
        data: {
          entityType: 'EXPENSE_CLAIM',
          entityId: claimId,
          level: 1,
          approverId: managerUser.id,
          decision: 'PENDING'
        }
      });

      // Audit log (FR-AUDIT-01)
      await AuditService.log({
        actorId: userId,
        actorEmail: empMaster.officialEmail,
        actionType: 'CLAIM_SUBMITTED',
        recordType: 'ExpenseClaim',
        recordId: claimId,
        newValue: {
          claimNo: claim.claimNo,
          totalAmountPaise: claim.totalAmountPaise,
          violationsCount: violations.length,
          policyVersion: activeVersion
        },
        ipAddress
      }, tx);

      // Notify manager
      await NotificationService.notify({
        userId: managerUser.id,
        recipientEmail: managerUser.employeeMaster?.officialEmail,
        title: `Expense Claim ${claim.claimNo} Pending Approval`,
        message: `${empMaster.name} submitted an expense claim of ₹${(claim.totalAmountPaise / 100).toFixed(2)}.`
      }, tx);

      return updated;
    });
  }

  // Withdraw Claim (FR-CLAIM-07)
  static async withdrawClaim(claimId: string, userId: string, ipAddress?: string) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.userId !== userId) throw new AppError(403, 'Unauthorized', 'FORBIDDEN');

    if (claim.status !== CLAIM_STATUS.PENDING_APPROVAL && claim.status !== CLAIM_STATUS.UNDER_POLICY_VALIDATION) {
      throw new AppError(400, 'A claim can only be withdrawn before manager approval (FR-CLAIM-07)', 'CANNOT_WITHDRAW');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.expenseClaim.update({
        where: { id: claimId },
        data: {
          status: CLAIM_STATUS.DRAFT,
          currentApproverId: null
        }
      });

      // Cancel pending approval record
      await tx.approval.deleteMany({
        where: { entityType: 'EXPENSE_CLAIM', entityId: claimId, decision: 'PENDING' }
      });

      await AuditService.log({
        actorId: userId,
        actorEmail: claim.user.employeeMaster.officialEmail,
        actionType: 'CLAIM_WITHDRAWN',
        recordType: 'ExpenseClaim',
        recordId: claimId,
        priorValue: { status: claim.status },
        newValue: { status: CLAIM_STATUS.DRAFT },
        ipAddress
      }, tx);

      return updated;
    });
  }

  // Query claims
  static async listUserClaims(userId?: string, status?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    return await prisma.expenseClaim.findMany({
      where,
      include: {
        travelRequest: true,
        lines: { include: { receipts: true } },
        violations: true,
        reimbursement: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getClaimDetails(claimId: string) {
    return await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: {
        user: { include: { employeeMaster: true } },
        travelRequest: true,
        lines: { include: { receipts: true } },
        violations: true,
        reimbursement: true,
        batchClaims: { include: { batch: true } }
      }
    });
  }
}
