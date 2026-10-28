import { prisma } from '../prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { SettingService } from './setting.service';
import { getBusinessDaysBetween } from '../utils/date';
import { TRAVEL_STATUS, ALLOWED_TRAVEL_TRANSITIONS, ROLES } from '../constants';

export class TravelService {
  // Submit Travel Request (FR-TRAVEL-01..08, FR-APPR-01)
  static async createTravelRequest(
    userId: string,
    data: {
      destination: string;
      startDate: string;
      endDate: string;
      purpose: string;
      justificationCategory?: string;
      estimatedBudgetPaise: number;
      shortNoticeReason?: string;
      overlapAcknowledged?: boolean;
    },
    ipAddress?: string
  ) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    // FR-TRAVEL-07: end date < start date -> reject
    if (end < start) {
      throw new AppError(400, 'Travel end date cannot precede start date (FR-TRAVEL-07)', 'INVALID_DATES');
    }

    // Check notice period (< 5 business days notice requires justification)
    const now = new Date();
    const noticeDays = getBusinessDaysBetween(now, start);
    if (noticeDays < 5 && (!data.shortNoticeReason || data.shortNoticeReason.trim().length === 0)) {
      throw new AppError(
        400,
        'Travel requested with less than 5 business days notice requires justification text.',
        'SHORT_NOTICE_JUSTIFICATION_REQUIRED'
      );
    }

    // Check overlap with user's active requests
    const overlapping = await prisma.travelRequest.findFirst({
      where: {
        userId,
        status: { in: [TRAVEL_STATUS.SUBMITTED, TRAVEL_STATUS.CLARIFICATION_REQUESTED, TRAVEL_STATUS.APPROVED, TRAVEL_STATUS.BOOKED] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } }
        ]
      }
    });

    if (overlapping && !data.overlapAcknowledged) {
      throw new AppError(
        400,
        `Travel dates overlap with active request #${overlapping.requestNo}. Acknowledge overlap to proceed.`,
        'OVERLAP_WARNING'
      );
    }

    // Identify designated Approving Manager from EmployeeMaster (FR-APPR-01)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employeeMaster: true }
    });

    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

    let managerUser: any = null;
    if (user.employeeMaster.reportsToEmployeeId) {
      const managerMaster = await prisma.employeeMaster.findUnique({
        where: { employeeId: user.employeeMaster.reportsToEmployeeId },
        include: { user: true }
      });
      if (managerMaster?.user && managerMaster.employmentStatus === 'active') {
        managerUser = managerMaster.user;
      }
    }

    // Fallback if no reporting manager assigned: route to admin
    if (!managerUser) {
      const adminRole = await prisma.userRole.findFirst({
        where: { role: ROLES.ADMIN },
        include: { user: { include: { employeeMaster: true } } }
      });
      if (adminRole?.user) {
        managerUser = adminRole.user;
      }
    }

    if (!managerUser) {
      throw new AppError(400, 'No active approving manager could be resolved for this employee.', 'NO_APPROVER');
    }

    // Generate unique sequential request number (FR-TRAVEL-02)
    const count = await prisma.travelRequest.count();
    const requestNo = `TR-${String(count + 1).padStart(5, '0')}`;

    // Execute creation in transaction
    const newRequest = await prisma.$transaction(async (tx) => {
      const req = await tx.travelRequest.create({
        data: {
          requestNo,
          userId,
          destination: data.destination,
          startDate: start,
          endDate: end,
          purpose: data.purpose,
          justificationCategory: data.justificationCategory,
          estimatedBudgetPaise: data.estimatedBudgetPaise,
          status: TRAVEL_STATUS.SUBMITTED,
          shortNoticeReason: data.shortNoticeReason,
          overlapAcknowledged: Boolean(data.overlapAcknowledged),
          currentApproverId: managerUser.id
        }
      });

      // Create level 1 Approval record
      await tx.approval.create({
        data: {
          entityType: 'TRAVEL_REQUEST',
          entityId: req.id,
          level: 1,
          approverId: managerUser.id,
          decision: 'PENDING'
        }
      });

      // Audit log (FR-AUDIT-01)
      await AuditService.log({
        actorId: userId,
        actorEmail: user.employeeMaster.officialEmail,
        actionType: 'TRAVEL_REQUEST_SUBMITTED',
        recordType: 'TravelRequest',
        recordId: req.id,
        newValue: { requestNo, status: TRAVEL_STATUS.SUBMITTED, budgetPaise: data.estimatedBudgetPaise },
        ipAddress
      }, tx);

      // Notify designated manager (FR-APPR-05, FR-NOTIF-01, FR-NOTIF-02)
      await NotificationService.notify({
        userId: managerUser.id,
        recipientEmail: managerUser.employeeMaster?.officialEmail,
        title: `New Travel Request ${requestNo} Pending Approval`,
        message: `${user.employeeMaster.name} has submitted a travel request to ${data.destination} for review.`
      }, tx);

      return req;
    });

    return newRequest;
  }

  // Edit Travel Request (FR-TRAVEL-05) - only in submitted or clarification_requested
  static async updateTravelRequest(
    requestId: string,
    userId: string,
    data: {
      destination?: string;
      startDate?: string;
      endDate?: string;
      purpose?: string;
      justificationCategory?: string;
      estimatedBudgetPaise?: number;
    },
    ipAddress?: string
  ) {
    const req = await prisma.travelRequest.findUnique({
      where: { id: requestId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!req) throw new AppError(404, 'Travel request not found', 'NOT_FOUND');
    if (req.userId !== userId) throw new AppError(403, 'Unauthorized to edit this request', 'FORBIDDEN');

    if (
      req.status !== TRAVEL_STATUS.SUBMITTED &&
      req.status !== TRAVEL_STATUS.CLARIFICATION_REQUESTED
    ) {
      throw new AppError(400, 'Travel request can only be edited while submitted or awaiting clarification (FR-TRAVEL-05)', 'INVALID_STATE');
    }

    const start = data.startDate ? new Date(data.startDate) : req.startDate;
    const end = data.endDate ? new Date(data.endDate) : req.endDate;
    if (end < start) {
      throw new AppError(400, 'End date cannot precede start date', 'INVALID_DATES');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.travelRequest.update({
        where: { id: requestId },
        data: {
          destination: data.destination ?? req.destination,
          startDate: start,
          endDate: end,
          purpose: data.purpose ?? req.purpose,
          justificationCategory: data.justificationCategory ?? req.justificationCategory,
          estimatedBudgetPaise: data.estimatedBudgetPaise ?? req.estimatedBudgetPaise,
          status: TRAVEL_STATUS.SUBMITTED // Resubmit if was clarification_requested
        }
      });

      await AuditService.log({
        actorId: userId,
        actorEmail: req.user.employeeMaster.officialEmail,
        actionType: 'TRAVEL_REQUEST_UPDATED',
        recordType: 'TravelRequest',
        recordId: req.id,
        priorValue: { destination: req.destination, status: req.status },
        newValue: { destination: updated.destination, status: updated.status },
        ipAddress
      }, tx);

      return updated;
    });
  }

  // Cancel Travel Request (FR-TRAVEL-06) - only before approval
  static async cancelTravelRequest(requestId: string, userId: string, ipAddress?: string) {
    const req = await prisma.travelRequest.findUnique({
      where: { id: requestId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!req) throw new AppError(404, 'Travel request not found', 'NOT_FOUND');
    if (req.userId !== userId) throw new AppError(403, 'Unauthorized to cancel this request', 'FORBIDDEN');

    const allowed = ALLOWED_TRAVEL_TRANSITIONS[req.status]?.includes(TRAVEL_STATUS.CANCELLED);
    if (!allowed || req.status === TRAVEL_STATUS.APPROVED) {
      throw new AppError(400, 'A travel request can only be cancelled prior to approval (FR-TRAVEL-06)', 'CANNOT_CANCEL');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.travelRequest.update({
        where: { id: requestId },
        data: { status: TRAVEL_STATUS.CANCELLED }
      });

      await AuditService.log({
        actorId: userId,
        actorEmail: req.user.employeeMaster.officialEmail,
        actionType: 'TRAVEL_REQUEST_CANCELLED',
        recordType: 'TravelRequest',
        recordId: req.id,
        priorValue: { status: req.status },
        newValue: { status: TRAVEL_STATUS.CANCELLED },
        ipAddress
      }, tx);

      return updated;
    });
  }

  // Get user travel requests
  static async listTravelRequests(userId?: string, status?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    return await prisma.travelRequest.findMany({
      where,
      include: {
        user: { include: { employeeMaster: true } },
        itinerary: { include: { components: true } },
        claims: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getById(id: string) {
    return await prisma.travelRequest.findUnique({
      where: { id },
      include: {
        user: { include: { employeeMaster: true } },
        itinerary: { include: { components: true } },
        claims: { include: { lines: true } },
        attachments: true
      }
    });
  }

  // Travel Attachments (FR-TRAVEL-09)
  static async addAttachment(
    travelRequestId: string,
    userId: string,
    file: Express.Multer.File,
    ipAddress?: string
  ) {
    const req = await prisma.travelRequest.findUnique({ where: { id: travelRequestId } });
    if (!req) throw new AppError(404, 'Travel request not found', 'NOT_FOUND');

    // Only the owner (or admin) can attach documents
    if (req.userId !== userId) {
      throw new AppError(403, 'You do not have permission to attach files to this request', 'FORBIDDEN');
    }

    const attachment = await prisma.travelAttachment.create({
      data: {
        travelRequestId,
        fileName: file.originalname,
        fileUrl: file.path,
        fileType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedById: userId
      }
    });

    await AuditService.log({
      actorId: userId,
      actionType: 'TRAVEL_ATTACHMENT_ADDED',
      recordType: 'TravelRequest',
      recordId: travelRequestId,
      newValue: { fileName: file.originalname, attachmentId: attachment.id },
      ipAddress
    });

    return attachment;
  }

  static async removeAttachment(
    travelRequestId: string,
    attachmentId: string,
    userId: string,
    ipAddress?: string
  ) {
    const attachment = await prisma.travelAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.travelRequestId !== travelRequestId) {
      throw new AppError(404, 'Attachment not found', 'NOT_FOUND');
    }
    if (attachment.uploadedById !== userId) {
      throw new AppError(403, 'You can only delete your own attachments', 'FORBIDDEN');
    }

    await prisma.travelAttachment.delete({ where: { id: attachmentId } });

    // Best-effort delete from disk
    try {
      const fs = await import('fs');
      fs.unlinkSync(attachment.fileUrl);
    } catch (_) {}

    await AuditService.log({
      actorId: userId,
      actionType: 'TRAVEL_ATTACHMENT_REMOVED',
      recordType: 'TravelRequest',
      recordId: travelRequestId,
      newValue: { fileName: attachment.fileName, attachmentId },
      ipAddress
    });

    return { message: 'Attachment removed successfully' };
  }

  static async getAttachment(attachmentId: string) {
    return await prisma.travelAttachment.findUnique({ where: { id: attachmentId } });
  }
}
