import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { ROLES } from '../constants';

const router = Router();

router.use(authenticateToken);

// Booking queue for Travel Desk
router.get('/queue', requireRole(ROLES.TRAVEL_DESK, ROLES.ADMIN), BookingController.getQueue);

// Record itinerary
router.post('/travel-requests/:id/itinerary', requireRole(ROLES.TRAVEL_DESK, ROLES.ADMIN), BookingController.recordItinerary);

export default router;
