export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  APPROVING_MANAGER: 'APPROVING_MANAGER',
  TRAVEL_DESK: 'TRAVEL_DESK',
  FINANCE: 'FINANCE',
  ADMIN: 'ADMIN',
  AUDITOR: 'AUDITOR'
} as const;

export type RoleType = typeof ROLES[keyof typeof ROLES];

export const TRAVEL_STATUS = {
  SUBMITTED: 'submitted',
  CLARIFICATION_REQUESTED: 'clarification_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  BOOKED: 'booked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const CLAIM_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_POLICY_VALIDATION: 'under_policy_validation',
  FLAGGED_FOR_CORRECTION: 'flagged_for_correction',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLARIFICATION_REQUESTED: 'clarification_requested',
  PROCESSED_BY_FINANCE: 'processed_by_finance',
  REIMBURSED: 'reimbursed'
} as const;

export const BATCH_STATUS = {
  CREATED: 'created',
  EXPORTED: 'exported',
  CONFIRMED: 'confirmed'
} as const;

// Prompt: Central allowedTransitions map for travel/claim/batch status; illegal transition -> 409
export const ALLOWED_TRAVEL_TRANSITIONS: Record<string, string[]> = {
  submitted: ['approved', 'rejected', 'clarification_requested', 'cancelled'],
  clarification_requested: ['submitted', 'cancelled'],
  approved: ['booked', 'cancelled'],
  rejected: [],
  booked: ['completed'],
  completed: [],
  cancelled: []
};

export const ALLOWED_CLAIM_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted', 'under_policy_validation'],
  submitted: ['under_policy_validation', 'pending_approval', 'draft'],
  under_policy_validation: ['pending_approval', 'draft'],
  pending_approval: ['approved', 'rejected', 'clarification_requested', 'draft'], // draft if withdrawn
  clarification_requested: ['submitted', 'draft'],
  approved: ['processed_by_finance', 'flagged_for_correction'],
  flagged_for_correction: ['submitted', 'draft'],
  processed_by_finance: ['reimbursed'],
  reimbursed: [],
  rejected: []
};

export const ALLOWED_BATCH_TRANSITIONS: Record<string, string[]> = {
  created: ['exported'],
  exported: ['confirmed'],
  confirmed: []
};

export const DEFAULT_SETTINGS: Record<string, string> = {
  bookingOverrunPct: '20',
  receiptThresholdPaise: '100000', // ₹1,000
  secondLevelTravelPaise: '5000000', // ₹50,000
  secondLevelClaimPaise: '2500000', // ₹25,000
  lockoutThreshold: '5',
  lockoutMinutes: '15',
  sessionMinutes: '30',
  slaDays: '3',
  simulateExportFailure: 'false'
};
