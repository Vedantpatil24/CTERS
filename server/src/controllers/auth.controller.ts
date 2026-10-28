import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

const requestActivationSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  officialEmail: z.string().email('Valid official email is required')
});

const completeActivationSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  otp: z.string().min(6, '6-digit OTP is required'),
  password: z.string().min(1, 'Password is required')
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  password: z.string().min(1, 'Password is required')
});

const resetRequestSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required')
});

const resetCompleteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
});

export class AuthController {
  static async requestActivation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = requestActivationSchema.parse(req.body);
      const result = await AuthService.requestActivation(data.employeeId, data.officialEmail, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async completeActivation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = completeActivationSchema.parse(req.body);
      const result = await AuthService.completeActivation(data.employeeId, data.otp, data.password, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.login(data.identifier, data.password, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ user: req.user });
    } catch (err) {
      next(err);
    }
  }

  static async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const data = resetRequestSchema.parse(req.body);
      const result = await AuthService.requestPasswordReset(data.identifier, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async completePasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const data = resetCompleteSchema.parse(req.body);
      const result = await AuthService.completePasswordReset(data.token, data.newPassword, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
