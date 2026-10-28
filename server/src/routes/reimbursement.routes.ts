import { Router } from 'express';
import { ReimbursementController } from '../controllers/reimbursement.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { ROLES } from '../constants';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(ROLES.FINANCE, ROLES.ADMIN));

router.get('/claims-queue', ReimbursementController.getQueue);
router.post('/claims/:id/verify', ReimbursementController.verifyClaim);
router.post('/claims/:id/return', ReimbursementController.returnClaim);

router.get('/batches', ReimbursementController.listBatches);
router.post('/batches', ReimbursementController.createBatch);
router.get('/batches/:id/export-csv', ReimbursementController.exportBatchCsv);
router.post('/batches/:id/confirm', ReimbursementController.confirmBatch);

export default router;
