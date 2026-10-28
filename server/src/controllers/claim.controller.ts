import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../types';
import { ClaimService } from '../services/claim.service';
import { ROLES } from '../constants';

const createClaimSchema = z.object({
  travelRequestId: z.string().min(1, 'Travel Request ID is required'),
  description: z.string().optional()
});

const addLineSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  amountPaise: z.number().int().positive('Amount must be positive'),
  description: z.string().optional()
});

export class ClaimController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isPrivileged = req.user!.roles.some(r => [ROLES.ADMIN, ROLES.FINANCE, ROLES.AUDITOR].includes(r as any));
      const userId = isPrivileged && req.query.all === 'true' ? undefined : req.user!.userId;
      const status = req.query.status as string | undefined;

      const claims = await ClaimService.listUserClaims(userId, status);
      res.status(200).json(claims);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const claim = await ClaimService.getClaimDetails(req.params.id);
      if (!claim) return res.status(404).json({ message: 'Claim not found' });
      res.status(200).json(claim);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createClaimSchema.parse(req.body);
      const claim = await ClaimService.createClaimDraft(req.user!.userId, data.travelRequestId, data.description, req.ip);
      res.status(201).json(claim);
    } catch (err) {
      next(err);
    }
  }

  static async addLine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = addLineSchema.parse(req.body);
      const line = await ClaimService.addLine(req.params.id, req.user!.userId, data);
      res.status(201).json(line);
    } catch (err) {
      next(err);
    }
  }

  static async removeLine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ClaimService.removeLine(req.params.id, req.params.lineId, req.user!.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async addReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No receipt file uploaded' });
      }

      const receipt = await ClaimService.addReceipt(
        req.params.id,
        req.params.lineId,
        req.user!.userId,
        {
          path: req.file.path,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      );
      res.status(201).json(receipt);
    } catch (err) {
      next(err);
    }
  }

  static async removeReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ClaimService.removeReceipt(req.params.id, req.params.receiptId, req.user!.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async downloadReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { id: req.params.receiptId }
      });

      if (!receipt || !fs.existsSync(receipt.fileUrl)) {
        return res.status(404).json({ message: 'Receipt file not found' });
      }

      res.setHeader('Content-Type', receipt.fileType);
      res.setHeader('Content-Disposition', `inline; filename="${receipt.fileName}"`);
      fs.createReadStream(receipt.fileUrl).pipe(res);
    } catch (err) {
      next(err);
    }
  }

  static async validate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ClaimService.validateClaimDryRun(req.params.id, req.user!.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async submit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ClaimService.submitClaim(req.params.id, req.user!.userId, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async withdraw(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ClaimService.withdrawClaim(req.params.id, req.user!.userId, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
