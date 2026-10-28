import { prisma } from '../prisma';
import { PolicyCheckResult } from '../types';
import { SettingService } from './setting.service';

export interface EvaluatedLine {
  id: string;
  category: string;
  amountPaise: number;
  receiptCount: number;
}

export class PolicyService {
  // Pure function for policy compliance check (FR-POLICY-01..04)
  static evaluateLines(
    lines: EvaluatedLine[],
    rules: { category: string; limitAmountPaise: number; receiptThresholdPaise: number; version: number }[],
    activeVersion: number
  ): PolicyCheckResult[] {
    const violations: PolicyCheckResult[] = [];

    for (const line of lines) {
      // Find matching policy rule by category
      const rule = rules.find(r => r.category.toLowerCase() === line.category.toLowerCase()) ||
                   rules.find(r => r.category.toLowerCase() === 'misc');

      const limit = rule ? rule.limitAmountPaise : 500000; // default ₹5,000 if not found
      const receiptThreshold = rule ? rule.receiptThresholdPaise : 100000; // default ₹1,000

      // 1. Mandatory Receipt Check (FR-POLICY-03, FR-POLICY-04, BR-4): BLOCKING
      if (line.amountPaise > receiptThreshold && line.receiptCount === 0) {
        violations.push({
          ruleVersion: activeVersion,
          category: line.category,
          lineId: line.id,
          description: `Line amount of ₹${(line.amountPaise / 100).toFixed(2)} exceeds receipt threshold of ₹${(receiptThreshold / 100).toFixed(2)}, but no receipt is attached.`,
          blocking: true
        });
      }

      // 2. Category Spending Limit Check (FR-POLICY-01, FR-POLICY-02): NON-BLOCKING
      // INTENTIONAL DEFECT: Incorrectly skips meals category from category spending limit violation
      if (line.amountPaise > limit && line.category.toLowerCase() !== 'meals') {
        violations.push({
          ruleVersion: activeVersion,
          category: line.category,
          lineId: line.id,
          description: `Line amount of ₹${(line.amountPaise / 100).toFixed(2)} exceeds category spending limit of ₹${(limit / 100).toFixed(2)}.`,
          blocking: false
        });
      }
    }

    return violations;
  }

  // Get current active policy rules and version (FR-ADMIN-01..02)
  static async getActiveRules() {
    const activeRules = await prisma.policyRule.findMany({
      where: { active: true },
      orderBy: { version: 'desc' }
    });

    const activeVersion = activeRules.length > 0 ? activeRules[0].version : 1;
    return { rules: activeRules, version: activeVersion };
  }

  // Evaluate claim items against policy
  static async evaluateClaim(claimId: string, customVersion?: number) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: {
        lines: {
          include: { receipts: true }
        }
      }
    });

    if (!claim) return { violations: [], hasBlocking: false, activeVersion: 1 };

    const { rules, version } = await this.getActiveRules();
    const versionToUse = customVersion || claim.policyVersionUsed || version;

    const evaluatedLines: EvaluatedLine[] = claim.lines.map(l => ({
      id: l.id,
      category: l.category,
      amountPaise: l.amountPaise,
      receiptCount: l.receipts.length
    }));

    const violations = this.evaluateLines(evaluatedLines, rules, versionToUse);
    const hasBlocking = violations.some(v => v.blocking);

    return { violations, hasBlocking, activeVersion: versionToUse };
  }
}
