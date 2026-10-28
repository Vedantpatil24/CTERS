import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { BookingService } from '../services/booking.service';

const recordItinerarySchema = z.object({
  components: z.array(z.object({
    type: z.string().min(1, 'Component type is required'),
    vendor: z.string().min(1, 'Vendor is required'),
    bookingReference: z.string().min(1, 'Booking reference is required'),
    actualCostPaise: z.number().int().nonnegative('Cost must be non-negative')
  })).min(1, 'At least one component is required')
});

export class BookingController {
  static async getQueue(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const queue = await BookingService.getQueue();
      res.status(200).json(queue);
    } catch (err) {
      next(err);
    }
  }

  static async recordItinerary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = recordItinerarySchema.parse(req.body);
      const result = await BookingService.recordItinerary(
        req.params.id,
        req.user!.userId,
        data.components,
        req.ip
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}
