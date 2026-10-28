import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

export interface AuditLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actionType: string;
  recordType: string;
  recordId?: string | null;
  priorValue?: any;
  newValue?: any;
  ipAddress?: string | null;
}

export class AuditService {
  static async log(
    input: AuditLogInput,
    db: PrismaClient | Prisma.TransactionClient = prisma
  ) {
    const priorStr = input.priorValue !== undefined && input.priorValue !== null
      ? (typeof input.priorValue === 'string' ? input.priorValue : JSON.stringify(input.priorValue))
      : null;
    const newStr = input.newValue !== undefined && input.newValue !== null
      ? (typeof input.newValue === 'string' ? input.newValue : JSON.stringify(input.newValue))
      : null;

    return await db.auditLogEntry.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actionType: input.actionType,
        recordType: input.recordType,
        recordId: input.recordId ? String(input.recordId) : null,
        priorValue: priorStr,
        newValue: newStr,
        ipAddress: input.ipAddress ?? null
      }
    });
  }

  static async search(filters: {
    userId?: string;
    actionType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: Prisma.AuditLogEntryWhereInput = {};

    if (filters.userId) {
      where.actorId = filters.userId;
    }
    if (filters.actionType) {
      where.actionType = filters.actionType;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.timestamp.lte = new Date(filters.endDate);
      }
    }

    return await prisma.auditLogEntry.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200
    });
  }
}
