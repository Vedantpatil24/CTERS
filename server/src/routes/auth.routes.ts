import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.post('/request-activation', AuthController.requestActivation);
router.post('/complete-activation', AuthController.completeActivation);
router.post('/login', AuthController.login);
router.post('/request-password-reset', AuthController.requestPasswordReset);
router.post('/complete-password-reset', AuthController.completePasswordReset);
router.get('/me', authenticateToken, AuthController.me);

export default router;
