import { Router } from 'express';
import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';
import travelRoutes from './travel.routes';
import approvalRoutes from './approval.routes';
import bookingRoutes from './booking.routes';
import claimRoutes from './claim.routes';
import reimbursementRoutes from './reimbursement.routes';
import adminRoutes from './admin.routes';
import auditRoutes from './audit.routes';
import notificationRoutes from './notification.routes';
import reportRoutes from './report.routes';
import { ClaimController } from '../controllers/claim.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/travel-requests', travelRoutes);
router.use('/approvals', approvalRoutes);
router.use('/bookings', bookingRoutes);
router.use('/claims', claimRoutes);
router.use('/finance', reimbursementRoutes);
router.use('/admin', adminRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);

// Direct receipt download endpoint (FR-RCPT-04)
router.get('/receipts/:receiptId/download', authenticateToken, ClaimController.downloadReceipt);

// Outbox direct endpoint for convenience
router.use('/outbox', auditRoutes);

export default router;
