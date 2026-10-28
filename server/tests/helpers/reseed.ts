/**
 * reseed.ts — Test helper
 * Wipes and re-seeds the database to a known clean state before each test suite.
 * Call `await reseed()` inside a `beforeAll()` block.
 */
import bcrypt from 'bcrypt';
import { prisma } from '../../src/prisma';
import { ROLES, TRAVEL_STATUS, CLAIM_STATUS, DEFAULT_SETTINGS } from '../../src/constants';

export async function reseed() {
  // ──────────────── 1. CLEAN ────────────────
  // Must delete in FK-safe order (children before parents)
  await prisma.auditLogEntry.deleteMany().catch(() => {});
  await prisma.notification.deleteMany();
  await prisma.emailOutbox.deleteMany();
  await prisma.otpToken.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.reimbursement.deleteMany();
  await prisma.batchClaim.deleteMany();
  await prisma.reimbursementBatch.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.policyViolation.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.expenseClaim.deleteMany();
  await prisma.itineraryComponent.deleteMany();
  await prisma.itinerary.deleteMany();
  await prisma.travelAttachment.deleteMany();
  await prisma.travelRequest.deleteMany();
  await prisma.policyRule.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employeeMaster.deleteMany();

  // ──────────────── 2. SETTINGS ────────────────
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.create({ data: { key, value } });
  }

  // ──────────────── 3. POLICY RULES ────────────────
  const policyRulesData = [
    { category: 'Flight',          limitAmountPaise: 3000000, receiptThresholdPaise: 100000, version: 1 },
    { category: 'Hotel',           limitAmountPaise: 1000000, receiptThresholdPaise: 100000, version: 1 },
    { category: 'Meals',           limitAmountPaise: 250000,  receiptThresholdPaise: 100000, version: 1 },
    { category: 'Local Transport', limitAmountPaise: 300000,  receiptThresholdPaise: 100000, version: 1 },
    { category: 'Misc',            limitAmountPaise: 500000,  receiptThresholdPaise: 100000, version: 1 },
    { category: 'Conference',      limitAmountPaise: 2000000, receiptThresholdPaise: 100000, version: 1 },
  ];
  for (const rule of policyRulesData) {
    await prisma.policyRule.create({
      data: { ...rule, noticePeriodDays: 5, active: true }
    });
  }

  // ──────────────── 4. EMPLOYEE MASTER ────────────────
  const employeesData = [
    { employeeId: 'EMP000', officialEmail: 'admin@cters.corp',       name: 'Admin User',             department: 'IT',          designation: 'Systems Administrator',       reportsToEmployeeId: null,     bankAccountRef: 'HDFC0001234567', employmentStatus: 'active' },
    { employeeId: 'EMP002', officialEmail: 'mgr2@cters.corp',        name: 'Dr. Evelyn Director',    department: 'Engineering', designation: 'Engineering Director',         reportsToEmployeeId: null,     bankAccountRef: 'ICIC0009876543', employmentStatus: 'active' },
    { employeeId: 'EMP001', officialEmail: 'mgr1@cters.corp',        name: 'Marcus Vance',           department: 'Engineering', designation: 'Engineering Manager',          reportsToEmployeeId: 'EMP002', bankAccountRef: 'SBIN0005551234', employmentStatus: 'active' },
    { employeeId: 'EMP003', officialEmail: 'emp1@cters.corp',        name: 'Alice Smith',            department: 'Engineering', designation: 'Senior Software Engineer',     reportsToEmployeeId: 'EMP001', bankAccountRef: 'HDFC0007778888', employmentStatus: 'active' },
    { employeeId: 'EMP004', officialEmail: 'emp2@cters.corp',        name: 'Bob Jones',              department: 'Engineering', designation: 'QA Engineer',                  reportsToEmployeeId: 'EMP001', bankAccountRef: 'AXIS0003334444', employmentStatus: 'active' },
    { employeeId: 'EMP005', officialEmail: 'travel1@cters.corp',     name: 'Tara Coordinator',       department: 'Operations',  designation: 'Travel Desk Lead',             reportsToEmployeeId: null,     bankAccountRef: 'KOTAK000111222', employmentStatus: 'active' },
    { employeeId: 'EMP006', officialEmail: 'fin1@cters.corp',        name: 'Fiona Cash',             department: 'Finance',     designation: 'Finance Officer',              reportsToEmployeeId: null,     bankAccountRef: 'SBIN0009990001', employmentStatus: 'active' },
    { employeeId: 'EMP007', officialEmail: 'auditor1@cters.corp',    name: 'Arthur Audit',           department: 'Compliance',  designation: 'Chief Internal Auditor',       reportsToEmployeeId: null,     bankAccountRef: 'HDFC0004445556', employmentStatus: 'active' },
    { employeeId: 'EMP008', officialEmail: 'emp3@cters.corp',        name: 'Charlie Brown',          department: 'Engineering', designation: 'DevOps Engineer',              reportsToEmployeeId: 'EMP001', bankAccountRef: 'ICIC0006667778', employmentStatus: 'active' },
    { employeeId: 'EMP009', officialEmail: 'emp4@cters.corp',        name: 'Diana Prince',           department: 'Marketing',   designation: 'Product Marketing Manager',    reportsToEmployeeId: 'EMP002', bankAccountRef: 'AXIS0008889990', employmentStatus: 'active' },
    { employeeId: 'EMP010', officialEmail: 'emp5@cters.corp',        name: 'Evan Wright',            department: 'Sales',       designation: 'Account Executive',            reportsToEmployeeId: 'EMP001', bankAccountRef: 'HDFC0002223334', employmentStatus: 'active' },
    { employeeId: 'EMP011', officialEmail: 'emp6@cters.corp',        name: 'Faye Valentine',         department: 'Support',     designation: 'Technical Support Lead',       reportsToEmployeeId: 'EMP002', bankAccountRef: 'SBIN0001114445', employmentStatus: 'active' },
    { employeeId: 'EMP012', officialEmail: 'newjoiner@cters.corp',   name: 'Nancy Newcomer',         department: 'Engineering', designation: 'Junior Developer',             reportsToEmployeeId: 'EMP001', bankAccountRef: 'HDFC0009998877', employmentStatus: 'active' },
    { employeeId: 'EMP013', officialEmail: 'terminated@cters.corp',  name: 'Tom Terminated',         department: 'Sales',       designation: 'Former Rep',                   reportsToEmployeeId: 'EMP001', bankAccountRef: 'SBIN0003332211', employmentStatus: 'terminated' },
    { employeeId: 'EMP014', officialEmail: 'onleave@cters.corp',     name: 'Olivia Onleave',         department: 'HR',          designation: 'HR Specialist',                reportsToEmployeeId: 'EMP002', bankAccountRef: 'AXIS0005556677', employmentStatus: 'on_leave' },
  ];

  const createdMasters: Record<string, any> = {};
  for (const emp of employeesData) {
    createdMasters[emp.employeeId] = await prisma.employeeMaster.create({ data: emp });
  }

  // ──────────────── 5. USERS ────────────────
  const passwordHash = await bcrypt.hash('Demo@1234', 10);
  const usersToCreate = [
    { empId: 'EMP000', roles: [ROLES.ADMIN, ROLES.EMPLOYEE] },
    { empId: 'EMP002', roles: [ROLES.APPROVING_MANAGER, ROLES.EMPLOYEE] },
    { empId: 'EMP001', roles: [ROLES.APPROVING_MANAGER, ROLES.EMPLOYEE] },
    { empId: 'EMP003', roles: [ROLES.EMPLOYEE] },
    { empId: 'EMP004', roles: [ROLES.EMPLOYEE] },
    { empId: 'EMP005', roles: [ROLES.TRAVEL_DESK, ROLES.EMPLOYEE] },
    { empId: 'EMP006', roles: [ROLES.FINANCE, ROLES.EMPLOYEE] },
    { empId: 'EMP007', roles: [ROLES.AUDITOR, ROLES.EMPLOYEE] },
    { empId: 'EMP013', roles: [ROLES.EMPLOYEE] },  // terminated — activated: false
  ];

  const createdUsers: Record<string, any> = {};
  for (const u of usersToCreate) {
    const master = createdMasters[u.empId];
    const user = await prisma.user.create({
      data: {
        employeeMasterId: master.id,
        passwordHash,
        activated: u.empId !== 'EMP013' ? true : false
      }
    });
    for (const r of u.roles) {
      await prisma.userRole.create({ data: { userId: user.id, role: r } });
    }
    createdUsers[u.empId] = user;
  }

  // ──────────────── 6. PRE-MADE TRAVEL REQUESTS ────────────────
  // TR-00001 — Alice, submitted (pending mgr1 approval)
  const tr1 = await prisma.travelRequest.create({
    data: {
      requestNo: 'TR-00001',
      userId: createdUsers['EMP003'].id,
      destination: 'Bangalore Tech Center',
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-14'),
      purpose: 'Architecture sync and quarterly planning',
      justificationCategory: 'Project Planning',
      estimatedBudgetPaise: 4500000,
      status: TRAVEL_STATUS.SUBMITTED,
      currentApproverId: createdUsers['EMP001'].id
    }
  });
  await prisma.approval.create({
    data: {
      entityType: 'TRAVEL_REQUEST',
      entityId: tr1.id,
      level: 1,
      approverId: createdUsers['EMP001'].id,
      decision: 'PENDING'
    }
  });

  // TR-00002 — Alice, booked (ready for expense claim)
  const tr2 = await prisma.travelRequest.create({
    data: {
      requestNo: 'TR-00002',
      userId: createdUsers['EMP003'].id,
      destination: 'Hyderabad Client Office',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      purpose: 'Onsite customer deployment and SLA review',
      justificationCategory: 'Client Delivery',
      estimatedBudgetPaise: 3500000,
      status: TRAVEL_STATUS.BOOKED
    }
  });
  await prisma.itinerary.create({
    data: {
      travelRequestId: tr2.id,
      totalCostPaise: 3200000,
      components: {
        create: [
          { type: 'flight', vendor: 'IndiGo',             bookingReference: '6E-4521-HYD', actualCostPaise: 1800000 },
          { type: 'hotel',  vendor: 'Marriott Hyderabad', bookingReference: 'MAR-882190',  actualCostPaise: 1400000 }
        ]
      }
    }
  });

  // TR-00003 — Bob, booked (CLM-00001 pending approval with violations)
  const tr3 = await prisma.travelRequest.create({
    data: {
      requestNo: 'TR-00003',
      userId: createdUsers['EMP004'].id,
      destination: 'Delhi Regional Office',
      startDate: new Date('2026-09-15'),
      endDate: new Date('2026-09-18'),
      purpose: 'Annual Partner Summit',
      justificationCategory: 'Business Development',
      estimatedBudgetPaise: 3000000,
      status: TRAVEL_STATUS.BOOKED
    }
  });
  const clm1 = await prisma.expenseClaim.create({
    data: {
      claimNo: 'CLM-00001',
      travelRequestId: tr3.id,
      userId: createdUsers['EMP004'].id,
      description: 'Expenses incurred during Delhi Partner Summit',
      totalAmountPaise: 1250000,
      status: CLAIM_STATUS.PENDING_APPROVAL,
      policyVersionUsed: 1,
      currentApproverId: createdUsers['EMP001'].id,
      submittedAt: new Date('2026-09-20')
    }
  });
  const line1 = await prisma.expenseLine.create({
    data: {
      claimId: clm1.id,
      category: 'Meals',
      date: new Date('2026-09-16'),
      amountPaise: 450000,
      convertedAmountPaise: 450000,
      description: 'Team dinner with client partners'
    }
  });
  const line2 = await prisma.expenseLine.create({
    data: {
      claimId: clm1.id,
      category: 'Local Transport',
      date: new Date('2026-09-17'),
      amountPaise: 800000,
      convertedAmountPaise: 800000,
      description: 'Airport cab transfers'
    }
  });
  await prisma.receipt.create({ data: { lineId: line1.id, fileName: 'dinner_bill.pdf',  fileUrl: 'uploads/demo1.pdf', fileType: 'application/pdf', fileSizeBytes: 204800 } });
  await prisma.receipt.create({ data: { lineId: line2.id, fileName: 'cab_receipt.pdf', fileUrl: 'uploads/demo2.pdf', fileType: 'application/pdf', fileSizeBytes: 102400 } });
  await prisma.policyViolation.create({ data: { claimId: clm1.id, lineId: line1.id, ruleVersion: 1, category: 'Meals',           description: 'Line ₹4,500 exceeds ₹2,500 meals limit.',     blocking: false } });
  await prisma.policyViolation.create({ data: { claimId: clm1.id, lineId: line2.id, ruleVersion: 1, category: 'Local Transport', description: 'Line ₹8,000 exceeds ₹3,000 transport limit.', blocking: false } });
  await prisma.approval.create({
    data: {
      entityType: 'EXPENSE_CLAIM',
      entityId: clm1.id,
      level: 1,
      approverId: createdUsers['EMP001'].id,
      decision: 'PENDING'
    }
  });

  // TR-00004 — Bob, booked (CLM-00002 processed_by_finance, ready for batch)
  const tr4 = await prisma.travelRequest.create({
    data: {
      requestNo: 'TR-00004',
      userId: createdUsers['EMP004'].id,
      destination: 'Pune Training Center',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-03'),
      purpose: 'Technical Security Certification',
      justificationCategory: 'Training',
      estimatedBudgetPaise: 2000000,
      status: TRAVEL_STATUS.BOOKED
    }
  });
  const clm2 = await prisma.expenseClaim.create({
    data: {
      claimNo: 'CLM-00002',
      travelRequestId: tr4.id,
      userId: createdUsers['EMP004'].id,
      description: 'Course registration & training expenses',
      totalAmountPaise: 1800000,
      status: CLAIM_STATUS.PROCESSED_BY_FINANCE,
      policyVersionUsed: 1,
      submittedAt: new Date('2026-09-05')
    }
  });
  await prisma.expenseLine.create({
    data: {
      claimId: clm2.id,
      category: 'Conference',
      date: new Date('2026-09-02'),
      amountPaise: 1800000,
      convertedAmountPaise: 1800000,
      description: 'Certification examination fee'
    }
  });

  // Seed initial audit log entry
  await prisma.auditLogEntry.create({
    data: {
      actorId: createdUsers['EMP000'].id,
      actorEmail: 'admin@cters.corp',
      actionType: 'SYSTEM_SEEDED',
      recordType: 'System',
      newValue: 'Test reseed completed'
    }
  });

  return { createdUsers, createdMasters };
}
