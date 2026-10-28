import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { ReimbursementService } from '../services/reimbursement.service';

const returnClaimSchema = z.object({
  reason: z.string().min(1, 'Reason for return is required')
});

const createBatchSchema = z.object({
  claimIds: z.array(z.string()).min(1, 'At least one claim must be selected')
});

const confirmBatchSchema = z.object({
  paymentReference: z.string().min(1, 'Payment reference is required')
});

export class ReimbursementController {
  static async getQueue(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const queue = await ReimbursementService.getQueue();
      res.status(200).json(queue);
    } catch (err) {
      next(err);
    }
  }

  static async verifyClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReimbursementService.verifyClaim(req.params.id, req.user!.userId, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async returnClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = returnClaimSchema.parse(req.body);
      const result = await ReimbursementService.returnClaimForCorrection(
        req.params.id,
        req.user!.userId,
        data.reason,
        req.ip
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async listBatches(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const batches = await ReimbursementService.listBatches();
      res.status(200).json(batches);
    } catch (err) {
      next(err);
    }
  }

  static async createBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createBatchSchema.parse(req.body);
      const batch = await ReimbursementService.createBatch(data.claimIds, req.user!.userId, req.ip);
      res.status(201).json(batch);
    } catch (err) {
      next(err);
    }
  }

  static async exportBatchCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReimbursementService.exportBatchCsv(req.params.id, req.user!.userId, req.ip);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.batchRef}.csv"`);
      res.status(200).send(result.csvContent);
    } catch (err) {
      next(err);
    }
  }

  static async confirmBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = confirmBatchSchema.parse(req.body);
      const result = await ReimbursementService.confirmBatchDisbursement(
        req.params.id,
        req.user!.userId,
        data.paymentReference,
        req.ip
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
