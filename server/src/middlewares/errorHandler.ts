import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppErrorResponse } from '../types';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public fieldErrors?: { field: string; message: string }[];

  constructor(statusCode: number, message: string, code: string = 'BAD_REQUEST', fieldErrors?: { field: string; message: string }[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    const response: AppErrorResponse = {
      code: err.code,
      message: err.message,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {})
    };
    return res.status(err.statusCode).json(response);
  }

  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    const response: AppErrorResponse = {
      code: 'VALIDATION_ERROR',
      message: 'Input validation failed',
      fieldErrors
    };
    return res.status(400).json(response);
  }

  // SQLite raised trigger errors (e.g. block_audit_update / block_audit_delete)
  if (err.message && err.message.includes('Audit logs are immutable')) {
    return res.status(403).json({
      code: 'IMMUTABLE_RECORD',
      message: err.message
    });
  }

  console.error('Unhandled Server Error:', err);
  const response: AppErrorResponse = {
    code: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred'
  };
  return res.status(500).json(response);
}
