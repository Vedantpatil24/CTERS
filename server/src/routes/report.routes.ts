import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { ROLES } from '../constants';

const router = Router();

router.use(authenticateToken);

// Dashboard summary available for all authenticated users (tailored per role)
router.get('/dashboard-summary', ReportController.getDashboardSummary);

// Reports available for Finance, Admin, Auditor, and Manager (for team)
router.get(
  '/travel-expense',
  requireRole(ROLES.FINANCE, ROLES.ADMIN, ROLES.AUDITOR, ROLES.APPROVING_MANAGER),
  ReportController.getTravelExpenseReport
);

router.get(
  '/policy-violations',
  requireRole(ROLES.ADMIN, ROLES.FINANCE, ROLES.AUDITOR),
  ReportController.getPolicyViolationSummary
);

export default router;
