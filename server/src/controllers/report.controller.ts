import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { ReportService } from '../services/report.service';

export class ReportController {
  static async getDashboardSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.getDashboardSummary(req.user!.userId, req.user!.roles);
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }

  static async getTravelExpenseReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, department, status, exportCsv } = req.query as any;
      const result = await ReportService.getTravelExpenseReport({
        startDate,
        endDate,
        department,
        status,
        exportCsv: exportCsv === 'true'
      });

      if (exportCsv === 'true' && (result as any).csvContent) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="travel_expense_report.csv"');
        return res.status(200).send((result as any).csvContent);
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getPolicyViolationSummary(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReportService.getPolicyViolationSummary();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
