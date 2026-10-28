import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', ProfileController.getProfile);
router.put('/bank', ProfileController.updateBank);

export default router;
