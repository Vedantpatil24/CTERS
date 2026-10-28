import { Router } from 'express';
import { ApprovalController } from '../controllers/approval.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { ROLES } from '../constants';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(ROLES.APPROVING_MANAGER, ROLES.ADMIN));

router.get('/pending', ApprovalController.listPending);
router.post('/decide', ApprovalController.decide);

export default router;
