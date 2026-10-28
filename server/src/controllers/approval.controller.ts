import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { ApprovalService } from '../services/approval.service';

const decideSchema = z.object({
  entityType: z.enum(['TRAVEL_REQUEST', 'EXPENSE_CLAIM']),
  entityId: z.string().min(1, 'Entity ID is required'),
  decision: z.enum(['APPROVE', 'REJECT', 'CLARIFY']),
  comment: z.string().optional()
});

export class ApprovalController {
  static async listPending(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const results = await ApprovalService.listPendingApprovals(req.user!.userId);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  }

  static async decide(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = decideSchema.parse(req.body);
      const result = await ApprovalService.decide(req.user!.userId, data, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
