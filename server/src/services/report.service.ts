import { prisma } from '../prisma';
import { CLAIM_STATUS, TRAVEL_STATUS } from '../constants';

export class ReportService {
  // Dashboards Summary (FR-DASH-01..04)
  static async getDashboardSummary(userId: string, roles: string[]) {
    const summary: Record<string, any> = {};

    // 1. Employee Dashboard (FR-DASH-01)
    if (roles.includes('EMPLOYEE')) {
      const activeTravelCount = await prisma.travelRequest.count({
        where: {
          userId,
          status: { in: [TRAVEL_STATUS.SUBMITTED, TRAVEL_STATUS.CLARIFICATION_REQUESTED, TRAVEL_STATUS.APPROVED, TRAVEL_STATUS.BOOKED] }
        }
      });
      const activeClaimsCount = await prisma.expenseClaim.count({
        where: {
          userId,
          status: { in: [CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.PENDING_APPROVAL, CLAIM_STATUS.CLARIFICATION_REQUESTED, CLAIM_STATUS.PROCESSED_BY_FINANCE] }
        }
      });
      summary.employee = { activeTravelCount, activeClaimsCount };
    }

    // 2. Approving Manager Dashboard (FR-DASH-02)
    if (roles.includes('APPROVING_MANAGER') || roles.includes('ADMIN')) {
      const pendingTravelApprovals = await prisma.approval.count({
        where: { approverId: userId, entityType: 'TRAVEL_REQUEST', decision: 'PENDING' }
      });
      const pendingClaimApprovals = await prisma.approval.count({
        where: { approverId: userId, entityType: 'EXPENSE_CLAIM', decision: 'PENDING' }
      });
      summary.manager = {
        pendingTravelApprovals,
        pendingClaimApprovals,
        totalPendingApprovals: pendingTravelApprovals + pendingClaimApprovals
      };
    }

    // 3. Finance Dashboard (FR-DASH-03)
    if (roles.includes('FINANCE') || roles.includes('ADMIN')) {
      const readyClaims = await prisma.expenseClaim.findMany({
        where: { status: CLAIM_STATUS.PROCESSED_BY_FINANCE }
      });
      const readyCount = readyClaims.length;
      const pendingDisbursementPaise = readyClaims.reduce((sum, c) => sum + c.totalAmountPaise, 0);

      const approvedPendingVerification = await prisma.expenseClaim.count({
        where: { status: CLAIM_STATUS.APPROVED }
      });

      summary.finance = {
        readyCount,
        pendingDisbursementPaise,
        pendingDisbursementInr: (pendingDisbursementPaise / 100).toFixed(2),
        approvedPendingVerification
      };
    }

    // 4. Admin Dashboard (FR-DASH-04)
    if (roles.includes('ADMIN')) {
      const activeUsersCount = await prisma.user.count({
        where: { activated: true, employeeMaster: { employmentStatus: 'active' } }
      });
      const openTravelRequests = await prisma.travelRequest.count({
        where: { status: { in: [TRAVEL_STATUS.SUBMITTED, TRAVEL_STATUS.APPROVED, TRAVEL_STATUS.BOOKED] } }
      });

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthlyReimbursements = await prisma.reimbursement.findMany({
        where: { paymentDate: { gte: startOfMonth } }
      });
      const monthlyReimbursedPaise = monthlyReimbursements.reduce((sum, r) => sum + r.amountPaise, 0);

      summary.admin = {
        activeUsersCount,
        openTravelRequests,
        monthlyReimbursementsCount: monthlyReimbursements.length,
        monthlyReimbursedPaise,
        monthlyReimbursedInr: (monthlyReimbursedPaise / 100).toFixed(2)
      };
    }

    // 5. Travel Desk
    if (roles.includes('TRAVEL_DESK') || roles.includes('ADMIN')) {
      const pendingBookingCount = await prisma.travelRequest.count({
        where: { status: TRAVEL_STATUS.APPROVED }
      });
      summary.travelDesk = { pendingBookingCount };
    }

    return summary;
  }

  // Filtered Travel & Expense Report (FR-REPORT-01..02)
  static async getTravelExpenseReport(filters: {
    startDate?: string;
    endDate?: string;
    department?: string;
    status?: string;
    exportCsv?: boolean;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.department) {
      where.user = {
        employeeMaster: { department: filters.department }
      };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const claims = await prisma.expenseClaim.findMany({
      where,
      include: {
        user: { include: { employeeMaster: true } },
        travelRequest: true,
        violations: true,
        reimbursement: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (filters.exportCsv) {
      const headers = ['Claim_No', 'Employee_ID', 'Employee_Name', 'Department', 'Travel_Request_No', 'Status', 'Total_Amount_INR', 'Violations_Count', 'Submitted_On'];
      const rows = claims.map(c => [
        c.claimNo,
        c.user.employeeMaster.employeeId,
        `"${c.user.employeeMaster.name.replace(/"/g, '""')}"`,
        `"${c.user.employeeMaster.department.replace(/"/g, '""')}"`,
        c.travelRequest.requestNo,
        c.status,
        (c.totalAmountPaise / 100).toFixed(2),
        c.violations.length,
        c.submittedAt ? c.submittedAt.toISOString().slice(0, 10) : 'N/A'
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      return { csvContent };
    }

    return { claims };
  }

  // Policy Violation Summary (FR-REPORT-04)
  static async getPolicyViolationSummary() {
    const violations = await prisma.policyViolation.findMany({
      include: {
        claim: {
          include: {
            user: { include: { employeeMaster: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Frequency by category
    const categoryFrequency: Record<string, number> = {};
    let blockingCount = 0;
    let nonBlockingCount = 0;

    for (const v of violations) {
      categoryFrequency[v.category] = (categoryFrequency[v.category] || 0) + 1;
      if (v.blocking) blockingCount++;
      else nonBlockingCount++;
    }

    return {
      totalViolations: violations.length,
      blockingCount,
      nonBlockingCount,
      categoryFrequency,
      recentViolations: violations.slice(0, 50)
    };
  }
}
