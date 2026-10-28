import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', NotificationController.list);
router.put('/mark-all-read', NotificationController.markAllRead);
router.put('/:id/read', NotificationController.markRead);

export default router;
