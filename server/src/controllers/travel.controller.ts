import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { TravelService } from '../services/travel.service';
import { ROLES } from '../constants';

const createTravelSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  justificationCategory: z.string().optional(),
  estimatedBudgetPaise: z.number().int().positive('Estimated budget must be positive'),
  shortNoticeReason: z.string().optional(),
  overlapAcknowledged: z.boolean().optional()
});

const updateTravelSchema = z.object({
  destination: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  purpose: z.string().optional(),
  justificationCategory: z.string().optional(),
  estimatedBudgetPaise: z.number().int().positive().optional()
});

export class TravelController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isPrivileged = req.user!.roles.some(r => [ROLES.ADMIN, ROLES.APPROVING_MANAGER, ROLES.TRAVEL_DESK, ROLES.AUDITOR].includes(r as any));
      const userId = isPrivileged && req.query.all === 'true' ? undefined : req.user!.userId;
      const status = req.query.status as string | undefined;

      const results = await TravelService.listTravelRequests(userId, status);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await TravelService.getById(req.params.id);
      if (!result) return res.status(404).json({ message: 'Travel request not found' });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createTravelSchema.parse(req.body);
      const result = await TravelService.createTravelRequest(req.user!.userId, data, req.ip);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateTravelSchema.parse(req.body);
      const result = await TravelService.updateTravelRequest(req.params.id, req.user!.userId, data, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await TravelService.cancelTravelRequest(req.params.id, req.user!.userId, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async uploadAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded', code: 'NO_FILE' });
      }
      const result = await TravelService.addAttachment(
        req.params.id,
        req.user!.userId,
        req.file,
        req.ip
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await TravelService.removeAttachment(
        req.params.id,
        req.params.attachmentId,
        req.user!.userId,
        req.ip
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async downloadAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const attachment = await TravelService.getAttachment(req.params.attachmentId);
      if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
      res.download(attachment.fileUrl, attachment.fileName);
    } catch (err) {
      next(err);
    }
  }
}
