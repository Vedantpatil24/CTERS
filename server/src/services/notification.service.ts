import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

export class NotificationService {
  static async notify(
    input: {
      userId?: string;
      recipientEmail?: string;
      title: string;
      message: string;
    },
    db: PrismaClient | Prisma.TransactionClient = prisma
  ) {
    // 1. In-app notification if userId is provided (FR-NOTIF-02, FR-NOTIF-03)
    if (input.userId) {
      await db.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          message: input.message,
          read: false
        }
      });
    }

    // 2. Email outbox entry (FR-NOTIF-01)
    if (input.recipientEmail) {
      await db.emailOutbox.create({
        data: {
          recipientEmail: input.recipientEmail,
          subject: input.title,
          body: input.message
        }
      });
      console.log(`[EMAIL OUTBOX] To: ${input.recipientEmail} | Subject: ${input.title} | Body: ${input.message}`);
    }
  }
}
