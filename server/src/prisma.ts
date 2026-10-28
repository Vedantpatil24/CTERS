import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Ensure SQLite DB triggers enforce audit log immutability (FR-AUDIT-03)
export async function initAuditTriggers() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS block_audit_update
      BEFORE UPDATE ON AuditLogEntry
      BEGIN
        SELECT RAISE(FAIL, 'Audit logs are immutable and cannot be updated (FR-AUDIT-03)');
      END;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS block_audit_delete
      BEFORE DELETE ON AuditLogEntry
      BEGIN
        SELECT RAISE(FAIL, 'Audit logs are immutable and cannot be deleted (FR-AUDIT-03)');
      END;
    `);
  } catch (err) {
    console.error('Failed to create audit immutability triggers:', err);
  }
}
