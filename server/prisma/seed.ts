import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ROLES, TRAVEL_STATUS, CLAIM_STATUS, DEFAULT_SETTINGS } from '../src/constants';

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('Cleaning database for fresh seed...');
  // Drop triggers temporarily if needed or delete tables in FK order
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
}

async function main() {
  await cleanDatabase();

  console.log('Seeding settings...');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.create({
      data: { key, value }
    });
  }

  console.log('Seeding 6 policy rules (version 1)...');
  const policyRulesData = [
    { category: 'Flight', limitAmountPaise: 3000000, receiptThresholdPaise: 100000, version: 1 }, // Limit ₹30,000, receipt ₹1,000
    { category: 'Hotel', limitAmountPaise: 1000000, receiptThresholdPaise: 100000, version: 1 },  // Limit ₹10,000
    { category: 'Meals', limitAmountPaise: 250000, receiptThresholdPaise: 100000, version: 1 },   // Limit ₹2,500
    { category: 'Local Transport', limitAmountPaise: 300000, receiptThresholdPaise: 100000, version: 1 }, // Limit ₹3,000
    { category: 'Misc', limitAmountPaise: 500000, receiptThresholdPaise: 100000, version: 1 },    // Limit ₹5,000
    { category: 'Conference', limitAmountPaise: 2000000, receiptThresholdPaise: 100000, version: 1 } // Limit ₹20,000
  ];

  for (const rule of policyRulesData) {
    await prisma.policyRule.create({
      data: {
        category: rule.category,
        limitAmountPaise: rule.limitAmountPaise,
        receiptThresholdPaise: rule.receiptThresholdPaise,
        noticePeriodDays: 5,
        version: rule.version,
        active: true
      }
    });
  }

  console.log('Seeding 15 EmployeeMaster records...');
  const employeesData = [
    // 1. Admin
    { employeeId: 'EMP000', officialEmail: 'admin@cters.corp', name: 'Admin User', department: 'IT', designation: 'Systems Administrator', reportsToEmployeeId: null, bankAccountRef: 'HDFC0001234567', employmentStatus: 'active' },
    // 2. Director (Manager 2)
    { employeeId: 'EMP002', officialEmail: 'mgr2@cters.corp', name: 'Dr. Evelyn Director', department: 'Engineering', designation: 'Engineering Director', reportsToEmployeeId: null, bankAccountRef: 'ICIC0009876543', employmentStatus: 'active' },
    // 3. Manager 1 (Reports to Director)
    { employeeId: 'EMP001', officialEmail: 'mgr1@cters.corp', name: 'Marcus Vance', department: 'Engineering', designation: 'Engineering Manager', reportsToEmployeeId: 'EMP002', bankAccountRef: 'SBIN0005551234', employmentStatus: 'active' },
    // 4. Employee 1 (Reports to Manager 1)
    { employeeId: 'EMP003', officialEmail: 'emp1@cters.corp', name: 'Alice Smith', department: 'Engineering', designation: 'Senior Software Engineer', reportsToEmployeeId: 'EMP001', bankAccountRef: 'HDFC0007778888', employmentStatus: 'active' },
    // 5. Employee 2 (Reports to Manager 1)
    { employeeId: 'EMP004', officialEmail: 'emp2@cters.corp', name: 'Bob Jones', department: 'Engineering', designation: 'QA Engineer', reportsToEmployeeId: 'EMP001', bankAccountRef: 'AXIS0003334444', employmentStatus: 'active' },
    // 6. Travel Desk
    { employeeId: 'EMP005', officialEmail: 'travel1@cters.corp', name: 'Tara Coordinator', department: 'Operations', designation: 'Travel Desk Lead', reportsToEmployeeId: null, bankAccountRef: 'KOTAK000111222', employmentStatus: 'active' },
    // 7. Finance
    { employeeId: 'EMP006', officialEmail: 'fin1@cters.corp', name: 'Fiona Cash', department: 'Finance', designation: 'Finance Officer', reportsToEmployeeId: null, bankAccountRef: 'SBIN0009990001', employmentStatus: 'active' },
    // 8. Auditor
    { employeeId: 'EMP007', officialEmail: 'auditor1@cters.corp', name: 'Arthur Audit', department: 'Compliance', designation: 'Chief Internal Auditor', reportsToEmployeeId: null, bankAccountRef: 'HDFC0004445556', employmentStatus: 'active' },
    // 9. Employee 3
    { employeeId: 'EMP008', officialEmail: 'emp3@cters.corp', name: 'Charlie Brown', department: 'Engineering', designation: 'DevOps Engineer', reportsToEmployeeId: 'EMP001', bankAccountRef: 'ICIC0006667778', employmentStatus: 'active' },
    // 10. Employee 4
    { employeeId: 'EMP009', officialEmail: 'emp4@cters.corp', name: 'Diana Prince', department: 'Marketing', designation: 'Product Marketing Manager', reportsToEmployeeId: 'EMP002', bankAccountRef: 'AXIS0008889990', employmentStatus: 'active' },
    // 11. Employee 5
    { employeeId: 'EMP010', officialEmail: 'emp5@cters.corp', name: 'Evan Wright', department: 'Sales', designation: 'Account Executive', reportsToEmployeeId: 'EMP001', bankAccountRef: 'HDFC0002223334', employmentStatus: 'active' },
    // 12. Employee 6
    { employeeId: 'EMP011', officialEmail: 'emp6@cters.corp', name: 'Faye Valentine', department: 'Support', designation: 'Technical Support Lead', reportsToEmployeeId: 'EMP002', bankAccountRef: 'SBIN0001114445', employmentStatus: 'active' },
    // 13. NOT YET ACTIVATED employee (for testing activation via OTP)
    { employeeId: 'EMP012', officialEmail: 'newjoiner@cters.corp', name: 'Nancy Newcomer', department: 'Engineering', designation: 'Junior Developer', reportsToEmployeeId: 'EMP001', bankAccountRef: 'HDFC0009998877', employmentStatus: 'active' },
    // 14. TERMINATED employee (for testing lockout / token rejection)
    { employeeId: 'EMP013', officialEmail: 'terminated@cters.corp', name: 'Tom Terminated', department: 'Sales', designation: 'Former Rep', reportsToEmployeeId: 'EMP001', bankAccountRef: 'SBIN0003332211', employmentStatus: 'terminated' },
    // 15. ON LEAVE employee
    { employeeId: 'EMP014', officialEmail: 'onleave@cters.corp', name: 'Olivia Onleave', department: 'HR', designation: 'HR Specialist', reportsToEmployeeId: 'EMP002', bankAccountRef: 'AXIS0005556677', employmentStatus: 'on_leave' }
  ];

  const createdMasters: Record<string, any> = {};
  for (const emp of employeesData) {
    const record = await prisma.employeeMaster.create({
      data: emp
    });
    createdMasters[emp.employeeId] = record;
  }

  console.log('Seeding Users with password Demo@1234...');
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
    // Also give user account to terminated employee to test token rejection
    { empId: 'EMP013', roles: [ROLES.EMPLOYEE] }
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
      await prisma.userRole.create({
        data: { userId: user.id, role: r }
      });
    }
    createdUsers[u.empId] = user;
  }

  console.log('Seeding pre-made records across different lifecycle stages...');
  // 1. Pending travel request for Alice (EMP003 / emp1) -> pending with Marcus (mgr1)
  const tr1 = await prisma.travelRequest.create({
    data: {
      requestNo: 'TR-00001',
      userId: createdUsers['EMP003'].id,
      destination: 'Bangalore Tech Center',
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-14'),
      purpose: 'Architecture sync and quarterly planning workshop',
      justificationCategory: 'Project Planning',
      estimatedBudgetPaise: 4500000, // ₹45,000
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

  // 2. Booked travel request for Alice (EMP003) -> Ready for expense claim!
  const tr2 = await prisma.travelRequest.create({
    data: {
      requestNo: 'TR-00002',
      userId: createdUsers['EMP003'].id,
      destination: 'Hyderabad Client Office',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      purpose: 'Onsite customer deployment and SLA review',
      justificationCategory: 'Client Delivery',
      estimatedBudgetPaise: 3500000, // ₹35,000
      status: TRAVEL_STATUS.BOOKED
    }
  });

  const itin2 = await prisma.itinerary.create({
    data: {
      travelRequestId: tr2.id,
      totalCostPaise: 3200000,
      components: {
        create: [
          { type: 'flight', vendor: 'IndiGo', bookingReference: '6E-4521-HYD', actualCostPaise: 1800000 },
          { type: 'hotel', vendor: 'Marriott Hyderabad', bookingReference: 'MAR-882190', actualCostPaise: 1400000 }
        ]
      }
    }
  });

  // 3. Booked travel request for Bob (EMP004 / emp2) with claim CLM-00001 pending approval with a policy violation flag
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
      totalAmountPaise: 1250000, // ₹12,500
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
      amountPaise: 450000, // ₹4,500 (exceeds ₹2,500 meals policy limit -> non-blocking flag!)
      convertedAmountPaise: 450000,
      description: 'Team dinner with client partners'
    }
  });

  const line2 = await prisma.expenseLine.create({
    data: {
      claimId: clm1.id,
      category: 'Local Transport',
      date: new Date('2026-09-17'),
      amountPaise: 800000, // ₹8,000 (exceeds ₹3,000 transport limit)
      convertedAmountPaise: 800000,
      description: 'Airport cab transfers'
    }
  });

  // Attach receipts
  await prisma.receipt.create({
    data: {
      lineId: line1.id,
      fileName: 'partner_dinner_bill.pdf',
      fileUrl: 'uploads/demo_receipt1.pdf',
      fileType: 'application/pdf',
      fileSizeBytes: 204800
    }
  });

  await prisma.receipt.create({
    data: {
      lineId: line2.id,
      fileName: 'cab_receipt.pdf',
      fileUrl: 'uploads/demo_receipt2.pdf',
      fileType: 'application/pdf',
      fileSizeBytes: 102400
    }
  });

  // Persist policy violation flags for CLM-00001
  await prisma.policyViolation.create({
    data: {
      claimId: clm1.id,
      lineId: line1.id,
      ruleVersion: 1,
      category: 'Meals',
      description: 'Line amount of ₹4,500.00 exceeds category spending limit of ₹2,500.00.',
      blocking: false
    }
  });

  await prisma.policyViolation.create({
    data: {
      claimId: clm1.id,
      lineId: line2.id,
      ruleVersion: 1,
      category: 'Local Transport',
      description: 'Line amount of ₹8,000.00 exceeds category spending limit of ₹3,000.00.',
      blocking: false
    }
  });

  await prisma.approval.create({
    data: {
      entityType: 'EXPENSE_CLAIM',
      entityId: clm1.id,
      level: 1,
      approverId: createdUsers['EMP001'].id,
      decision: 'PENDING'
    }
  });

  // 4. Claim CLM-00002 for Bob (EMP004) in 'processed_by_finance' ("Ready for Disbursement")
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
      totalAmountPaise: 1800000, // ₹18,000
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

  console.log('Seeding initial audit logs...');
  await prisma.auditLogEntry.create({
    data: {
      actorId: createdUsers['EMP000'].id,
      actorEmail: 'admin@cters.corp',
      actionType: 'SYSTEM_SEEDED',
      recordType: 'System',
      newValue: 'Initial seed completed successfully'
    }
  });

  console.log('====================================================');
  console.log('CTERS SEED COMPLETED SUCCESSFULLY!');
  console.log('Demo Credentials (Password: Demo@1234 for all):');
  console.log('  Admin:        admin@cters.corp     (EMP000)');
  console.log('  Manager 2:    mgr2@cters.corp      (EMP002)');
  console.log('  Manager 1:    mgr1@cters.corp      (EMP001)');
  console.log('  Employee 1:   emp1@cters.corp      (EMP003)');
  console.log('  Employee 2:   emp2@cters.corp      (EMP004)');
  console.log('  Travel Desk:  travel1@cters.corp   (EMP005)');
  console.log('  Finance:      fin1@cters.corp      (EMP006)');
  console.log('  Auditor:      auditor1@cters.corp  (EMP007)');
  console.log('Unactivated Employee:  newjoiner@cters.corp (EMP012)');
  console.log('Terminated Employee:   terminated@cters.corp (EMP013)');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
