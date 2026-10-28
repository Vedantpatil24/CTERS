import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { AuditService } from '../services/audit.service';
import { prisma } from '../prisma';

export class AuditController {
  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId, actionType, startDate, endDate } = req.query as {
        userId?: string;
        actionType?: string;
        startDate?: string;
        endDate?: string;
      };

      const logs = await AuditService.search({ userId, actionType, startDate, endDate });
      res.status(200).json(logs);
    } catch (err) {
      next(err);
    }
  }

  static async getOutbox(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const outbox = await prisma.emailOutbox.findMany({
        orderBy: { sentAt: 'desc' },
        take: 100
      });
      res.status(200).json(outbox);
    } catch (err) {
      next(err);
    }
  }
}
