import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { ROLES } from '../constants';

const router = Router();

router.use(authenticateToken);

// Auditor & Admin
router.get('/', requireRole(ROLES.AUDITOR, ROLES.ADMIN), AuditController.search);

// Outbox view (Admin, Auditor, Demo purposes)
router.get('/outbox', requireRole(ROLES.ADMIN, ROLES.AUDITOR), AuditController.getOutbox);

export default router;
