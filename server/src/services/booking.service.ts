import { prisma } from '../prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { SettingService } from './setting.service';
import { TRAVEL_STATUS, ROLES } from '../constants';

export class BookingService {
  // List approved travel requests waiting for booking (FR-BOOK-01)
  static async getQueue() {
    return await prisma.travelRequest.findMany({
      where: { status: TRAVEL_STATUS.APPROVED },
      include: {
        user: { include: { employeeMaster: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  // Record itinerary and components (FR-BOOK-02..06, BR-2)
  static async recordItinerary(
    travelRequestId: string,
    coordinatorId: string,
    components: {
      type: string;
      vendor: string;
      bookingReference: string;
      actualCostPaise: number;
    }[],
    ipAddress?: string
  ) {
    if (!components || components.length === 0) {
      throw new AppError(400, 'At least one itinerary component is required', 'COMPONENTS_REQUIRED');
    }

    const req = await prisma.travelRequest.findUnique({
      where: { id: travelRequestId },
      include: { user: { include: { employeeMaster: true } } }
    });

    if (!req) throw new AppError(404, 'Travel request not found', 'NOT_FOUND');

    // Only approved travel requests can be booked (BR-2)
    if (req.status !== TRAVEL_STATUS.APPROVED) {
      throw new AppError(400, `Cannot book a travel request with status ${req.status} (BR-2)`, 'INVALID_STATE');
    }

    // Calculate total actual cost
    const totalActualCostPaise = components.reduce((sum, c) => sum + (c.actualCostPaise || 0), 0);

    // Check budget overrun threshold (FR-BOOK-06)
    const overrunPct = await SettingService.getNumber('bookingOverrunPct') || 20;
    const overrunLimit = req.estimatedBudgetPaise * (1 + overrunPct / 100);
    const flaggedForAdmin = totalActualCostPaise > overrunLimit;

    const coordinator = await prisma.user.findUnique({
      where: { id: coordinatorId },
      include: { employeeMaster: true }
    });

    return await prisma.$transaction(async (tx) => {
      // Create or update itinerary
      const itinerary = await tx.itinerary.create({
        data: {
          travelRequestId: req.id,
          totalCostPaise: totalActualCostPaise,
          components: {
            create: components.map(c => ({
              type: c.type,
              vendor: c.vendor,
              bookingReference: c.bookingReference,
              actualCostPaise: c.actualCostPaise
            }))
          }
        },
        include: { components: true }
      });

      // Update Travel Request to 'booked' (and flag if overrun exceeded)
      const updatedReq = await tx.travelRequest.update({
        where: { id: req.id },
        data: {
          status: TRAVEL_STATUS.BOOKED,
          flaggedForAdmin
        }
      });

      // Audit log (FR-AUDIT-01)
      await AuditService.log({
        actorId: coordinatorId,
        actorEmail: coordinator?.employeeMaster.officialEmail,
        actionType: 'ITINERARY_BOOKED',
        recordType: 'TravelRequest',
        recordId: req.id,
        newValue: {
          status: TRAVEL_STATUS.BOOKED,
          totalCostPaise: totalActualCostPaise,
          flaggedForAdmin
        },
        ipAddress
      }, tx);

      // Notify Employee (FR-BOOK-05, FR-NOTIF-01)
      await NotificationService.notify({
        userId: req.userId,
        recipientEmail: req.user.employeeMaster.officialEmail,
        title: `Itinerary Confirmed: Request ${req.requestNo}`,
        message: `Your travel request to ${req.destination} has been booked. You can now view your itinerary.`
      }, tx);

      // If flagged for admin, notify Admin (FR-BOOK-06)
      if (flaggedForAdmin) {
        const admins = await tx.userRole.findMany({
          where: { role: ROLES.ADMIN },
          include: { user: { include: { employeeMaster: true } } }
        });
        for (const adm of admins) {
          await NotificationService.notify({
            userId: adm.userId,
            recipientEmail: adm.user.employeeMaster.officialEmail,
            title: `Booking Cost Overrun: Request ${req.requestNo}`,
            message: `Actual booking cost (₹${(totalActualCostPaise / 100).toFixed(2)}) exceeds estimated budget by >${overrunPct}%.`
          }, tx);
        }
      }

      return { request: updatedReq, itinerary };
    });
  }
}
