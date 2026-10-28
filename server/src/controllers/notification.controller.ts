import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../prisma';

export class NotificationController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      res.status(200).json(notifications);
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user!.userId },
        data: { read: true }
      });
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user!.userId, read: false },
        data: { read: true }
      });
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
