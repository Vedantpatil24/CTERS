import { prisma } from '../prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { SettingService } from './setting.service';
import { CLAIM_STATUS, BATCH_STATUS, ROLES } from '../constants';

export class ReimbursementService {
  // Finance verification queue (FR-REIMB-01)
  static async getQueue() {
    return await prisma.expenseClaim.findMany({
      where: {
        status: { in: [CLAIM_STATUS.APPROVED, CLAIM_STATUS.PROCESSED_BY_FINANCE] }
      },
      include: {
        user: { include: { employeeMaster: true } },
        travelRequest: true,
        violations: true,
        lines: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  // Verify claim by Finance: marks as processed_by_finance ("Ready for Disbursement") (FR-REIMB-02)
  static async verifyClaim(claimId: string, financeUserId: string, ipAddress?: string) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.status !== CLAIM_STATUS.APPROVED) {
      throw new AppError(400, `Claim cannot be verified from status ${claim.status}. Must be approved.`, 'INVALID_STATUS');
    }

    const finUser = await prisma.user.findUnique({
      where: { id: financeUserId },
      include: { employeeMaster: true }
    });

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.expenseClaim.update({
        where: { id: claimId },
        data: { status: CLAIM_STATUS.PROCESSED_BY_FINANCE }
      });

      await AuditService.log({
        actorId: financeUserId,
        actorEmail: finUser?.employeeMaster.officialEmail,
        actionType: 'CLAIM_VERIFIED_BY_FINANCE',
        recordType: 'ExpenseClaim',
        recordId: claimId,
        priorValue: { status: claim.status },
        newValue: { status: CLAIM_STATUS.PROCESSED_BY_FINANCE },
        ipAddress
      }, tx);

      await NotificationService.notify({
        userId: claim.userId,
        recipientEmail: claim.user.employeeMaster.officialEmail,
        title: `Claim ${claim.claimNo} Verified by Finance`,
        message: `Your claim has been verified and marked Ready for Disbursement.`
      }, tx);

      return updated;
    });
  }

  // Return claim for correction (FR-REIMB-06)
  static async returnClaimForCorrection(
    claimId: string,
    financeUserId: string,
    reason: string,
    ipAddress?: string
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new AppError(400, 'A reason is required to return a claim for correction (FR-REIMB-06)', 'REASON_REQUIRED');
    }

    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!claim) throw new AppError(404, 'Claim not found', 'NOT_FOUND');
    if (claim.status !== CLAIM_STATUS.APPROVED && claim.status !== CLAIM_STATUS.PROCESSED_BY_FINANCE) {
      throw new AppError(400, `Claim cannot be returned from status ${claim.status}`, 'INVALID_STATUS');
    }

    const finUser = await prisma.user.findUnique({
      where: { id: financeUserId },
      include: { employeeMaster: true }
    });

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.expenseClaim.update({
        where: { id: claimId },
        data: { status: CLAIM_STATUS.FLAGGED_FOR_CORRECTION }
      });

      await AuditService.log({
        actorId: financeUserId,
        actorEmail: finUser?.employeeMaster.officialEmail,
        actionType: 'CLAIM_FLAGGED_FOR_CORRECTION',
        recordType: 'ExpenseClaim',
        recordId: claimId,
        priorValue: { status: claim.status },
        newValue: { status: CLAIM_STATUS.FLAGGED_FOR_CORRECTION, reason },
        ipAddress
      }, tx);

      await NotificationService.notify({
        userId: claim.userId,
        recipientEmail: claim.user.employeeMaster.officialEmail,
        title: `Claim ${claim.claimNo} Returned for Correction`,
        message: `Finance returned your claim with reason: ${reason}`
      }, tx);

      return updated;
    });
  }

  // Create Reimbursement Batch (FR-REIMB-03)
  static async createBatch(claimIds: string[], financeUserId: string, ipAddress?: string) {
    if (!claimIds || claimIds.length === 0) {
      throw new AppError(400, 'Select at least one claim to create a batch', 'EMPTY_BATCH');
    }

    const claims = await prisma.expenseClaim.findMany({
      where: {
        id: { in: claimIds },
        status: CLAIM_STATUS.PROCESSED_BY_FINANCE
      }
    });

    if (claims.length !== claimIds.length) {
      throw new AppError(
        400,
        'One or more selected claims are not ready for disbursement (status must be processed_by_finance)',
        'INVALID_CLAIMS'
      );
    }

    const count = await prisma.reimbursementBatch.count();
    const batchRef = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
    const totalAmountPaise = claims.reduce((sum, c) => sum + c.totalAmountPaise, 0);

    const finUser = await prisma.user.findUnique({
      where: { id: financeUserId },
      include: { employeeMaster: true }
    });

    return await prisma.$transaction(async (tx) => {
      const batch = await tx.reimbursementBatch.create({
        data: {
          batchRef,
          status: BATCH_STATUS.CREATED,
          totalAmountPaise,
          claims: {
            create: claimIds.map(claimId => ({ claimId }))
          }
        },
        include: {
          claims: { include: { claim: true } }
        }
      });

      await AuditService.log({
        actorId: financeUserId,
        actorEmail: finUser?.employeeMaster.officialEmail,
        actionType: 'REIMBURSEMENT_BATCH_CREATED',
        recordType: 'ReimbursementBatch',
        recordId: batch.id,
        newValue: { batchRef, claimCount: claimIds.length, totalAmountPaise },
        ipAddress
      }, tx);

      return batch;
    });
  }

  // Export CSV (FR-REIMB-03, REL-01)
  static async exportBatchCsv(batchId: string, financeUserId: string, ipAddress?: string) {
    // Check simulateExportFailure setting
    const simFail = await SettingService.getBoolean('simulateExportFailure');
    if (simFail) {
      const finUser = await prisma.user.findUnique({
        where: { id: financeUserId },
        include: { employeeMaster: true }
      });
      await NotificationService.notify({
        userId: financeUserId,
        recipientEmail: finUser?.employeeMaster.officialEmail,
        title: 'Bank Export Failed (Simulation)',
        message: 'Reimbursement batch export to Payroll/Accounts System failed. Claims remain ready. Please retry.'
      });
      throw new AppError(500, 'Bank Export failed (simulateExportFailure is enabled). Claims remain ready.', 'EXPORT_FAILED');
    }

    const batch = await prisma.reimbursementBatch.findUnique({
      where: { id: batchId },
      include: {
        claims: {
          include: {
            claim: {
              include: {
                user: { include: { employeeMaster: true } }
              }
            }
          }
        }
      }
    });

    if (!batch) throw new AppError(404, 'Batch not found', 'NOT_FOUND');

    // Build CSV: employee_id, employee_name, bank_ref, amount, claim_ref, batch_ref
    const headers = ['employee_id', 'employee_name', 'bank_ref', 'amount', 'claim_ref', 'batch_ref'];
    const rows = batch.claims.map(bc => {
      const c = bc.claim;
      const emp = c.user.employeeMaster;
      const amountInr = (c.totalAmountPaise / 100).toFixed(2);
      return [
        emp.employeeId,
        `"${emp.name.replace(/"/g, '""')}"`,
        emp.bankAccountRef || 'N/A',
        amountInr,
        c.claimNo,
        batch.batchRef
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    await prisma.reimbursementBatch.update({
      where: { id: batchId },
      data: {
        status: BATCH_STATUS.EXPORTED,
        exportedAt: new Date()
      }
    });

    await AuditService.log({
      actorId: financeUserId,
      actionType: 'REIMBURSEMENT_BATCH_EXPORTED',
      recordType: 'ReimbursementBatch',
      recordId: batch.id,
      newValue: { batchRef: batch.batchRef, count: batch.claims.length },
      ipAddress
    });

    return { csvContent, batchRef: batch.batchRef };
  }

  // Confirm disbursement in ONE transaction (FR-REIMB-04..05, BR-5)
  // Concurrency safe: UNIQUE claimId + status check
  static async confirmBatchDisbursement(
    batchId: string,
    financeUserId: string,
    paymentReference: string,
    ipAddress?: string
  ) {
    if (!paymentReference || paymentReference.trim().length === 0) {
      throw new AppError(400, 'Payment reference is mandatory for disbursement confirmation (FR-REIMB-05)', 'PAYMENT_REF_REQUIRED');
    }

    const finUser = await prisma.user.findUnique({
      where: { id: financeUserId },
      include: { employeeMaster: true }
    });

    return await prisma.$transaction(async (tx) => {
      const batch = await tx.reimbursementBatch.findUnique({
        where: { id: batchId },
        include: {
          claims: {
            include: {
              claim: {
                include: {
                  user: { include: { employeeMaster: true } }
                }
              }
            }
          }
        }
      });

      if (!batch) throw new AppError(404, 'Batch not found', 'NOT_FOUND');
      if (batch.status === BATCH_STATUS.CONFIRMED) {
        throw new AppError(409, 'Batch has already been confirmed and disbursed', 'ALREADY_CONFIRMED');
      }

      // Update batch status
      await tx.reimbursementBatch.update({
        where: { id: batchId },
        data: {
          status: BATCH_STATUS.CONFIRMED,
          confirmedAt: new Date()
        }
      });

      const confirmedClaims = [];

      for (const bc of batch.claims) {
        const c = bc.claim;

        // Verify status precondition
        if (c.status === CLAIM_STATUS.REIMBURSED) {
          throw new AppError(409, `Claim ${c.claimNo} has already been reimbursed.`, 'ALREADY_REIMBURSED');
        }

        // Create Reimbursement row (claimId is UNIQUE in schema)
        const reimb = await tx.reimbursement.create({
          data: {
            claimId: c.id,
            amountPaise: c.totalAmountPaise,
            paymentReference,
            paymentDate: new Date(),
            processedByUserId: financeUserId
          }
        });

        // Update claim status to reimbursed
        const updatedClaim = await tx.expenseClaim.update({
          where: { id: c.id },
          data: { status: CLAIM_STATUS.REIMBURSED }
        });

        confirmedClaims.push(updatedClaim);

        // Audit log
        await AuditService.log({
          actorId: financeUserId,
          actorEmail: finUser?.employeeMaster.officialEmail,
          actionType: 'CLAIM_REIMBURSED',
          recordType: 'ExpenseClaim',
          recordId: c.id,
          priorValue: { status: c.status },
          newValue: { status: CLAIM_STATUS.REIMBURSED, paymentReference, reimbursementId: reimb.id },
          ipAddress
        }, tx);

        // Notify employee (FR-REIMB-07)
        await NotificationService.notify({
          userId: c.userId,
          recipientEmail: c.user.employeeMaster.officialEmail,
          title: `Claim ${c.claimNo} Reimbursed!`,
          message: `Your expense claim of ₹${(c.totalAmountPaise / 100).toFixed(2)} has been successfully disbursed. Payment Ref: ${paymentReference}.`
        }, tx);
      }

      return {
        batchRef: batch.batchRef,
        status: BATCH_STATUS.CONFIRMED,
        confirmedCount: confirmedClaims.length
      };
    });
  }

  static async listBatches() {
    return await prisma.reimbursementBatch.findMany({
      include: {
        claims: {
          include: {
            claim: {
              include: { user: { include: { employeeMaster: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
