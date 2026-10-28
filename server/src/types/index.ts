import { Request } from 'express';

export interface AuthUser {
  userId: string;
  employeeMasterId: string;
  employeeId: string;
  officialEmail: string;
  name: string;
  department: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface AppErrorResponse {
  code: string;
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

export interface PolicyCheckResult {
  ruleVersion: number;
  category: string;
  description: string;
  blocking: boolean;
  lineId?: string;
}
