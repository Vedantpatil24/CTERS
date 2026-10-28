import { Router } from 'express';
import multer from 'multer';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { ROLES } from '../constants';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticateToken);
router.use(requireRole(ROLES.ADMIN));

// Employee Master
router.get('/employees', AdminController.listEmployees);
router.post('/employees', AdminController.createEmployee);
router.post('/employees/import-csv', upload.single('file'), AdminController.importEmployeesCsv);

// Users
router.get('/users', AdminController.listUsers);
router.post('/users', AdminController.createUser);
router.put('/users/:id/roles', AdminController.updateRoles);
router.post('/users/:id/deactivate', AdminController.deactivateUser);
router.post('/users/:id/reassign-manager', AdminController.reassignManager);

// Approvals & Escalation
router.post('/approvals/reassign', AdminController.reassignApproval);
router.post('/run-escalation', AdminController.runEscalation);

// Policies
router.get('/policies', AdminController.listPolicies);
router.post('/policies', AdminController.createPolicy);
router.put('/policies/:id/deactivate', AdminController.deactivatePolicy);

// Settings
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);

export default router;
