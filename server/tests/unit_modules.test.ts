import { describe, it, expect } from 'vitest';
import { AuthService } from '../src/services/auth.service';
import { PolicyService } from '../src/services/policy.service';

/**
 * 10 Unit Test Cases (5 for Module 1, 5 for Module 2)
 *
 * Module 1: Authentication & Password Validation (Auth Module)
 * Module 2: Policy Compliance & Expense Evaluation (Policy Engine Module)
 *
 * Expected Outcome:
 * - 8 PASSED cases
 * - 2 FAILED cases (intentionally caused by subtle business logic modifications)
 */

describe('Module 1: Authentication & Security Validation (Auth Module)', () => {
  // Test Case 1 (PASS): Valid strong password matching all criteria
  it('TC01_Auth: should accept valid password meeting complexity criteria (>=8 chars, 1 digit, 1 special char)', () => {
    const validPassword = 'SecurePass@2026';
    const isValid = AuthService.validatePasswordStrength(validPassword);
    expect(isValid).toBe(true);
  });

  // Test Case 2 (PASS): Weak password with less than 8 characters is rejected
  it('TC02_Auth: should reject password that has fewer than 8 characters', () => {
    const shortPassword = 'Pass1!';
    const isValid = AuthService.validatePasswordStrength(shortPassword);
    expect(isValid).toBe(false);
  });

  // Test Case 3 (PASS): Weak password lacking numeric digit is rejected
  it('TC03_Auth: should reject password without any numeric digit', () => {
    const noDigitPassword = 'PasswordSpecial!';
    const isValid = AuthService.validatePasswordStrength(noDigitPassword);
    expect(isValid).toBe(false);
  });

  // Test Case 4 (PASS): Weak password lacking special character is rejected
  it('TC04_Auth: should reject password without any special character', () => {
    const noSpecialPassword = 'Password2026';
    const isValid = AuthService.validatePasswordStrength(noSpecialPassword);
    expect(isValid).toBe(false);
  });

  // Test Case 5 (FAIL): Regular test case expecting valid password with special character to pass,
  // but fails due to modified bug in AuthService.validatePasswordStrength
  it('TC05_Auth: should accept valid strong password with symbol # (Intended to FAIL due to introduced defect)', () => {
    const validPasswordWithHash = 'Corporate#2026';
    const isValid = AuthService.validatePasswordStrength(validPasswordWithHash);
    // Standard test expectation: a strong password meeting all criteria should return true
    expect(isValid).toBe(true);
  });
});

describe('Module 2: Expense Policy Evaluation (Policy Engine Module)', () => {
  const sampleRules = [
    { category: 'travel', limitAmountPaise: 500000, receiptThresholdPaise: 100000, version: 1 }, // limit ₹5,000, receipt thresh ₹1,000
    { category: 'meals', limitAmountPaise: 150000, receiptThresholdPaise: 50000, version: 1 },    // limit ₹1,500, receipt thresh ₹500
    { category: 'misc', limitAmountPaise: 100000, receiptThresholdPaise: 50000, version: 1 }
  ];

  // Test Case 6 (PASS): Expense within both spending limit and receipt threshold produces no violations
  it('TC06_Policy: should approve expense item within limit and below receipt threshold without receipt', () => {
    const lines = [
      { id: 'line-1', category: 'meals', amountPaise: 40000, receiptCount: 0 } // ₹400 <= ₹500 threshold
    ];
    const violations = PolicyService.evaluateLines(lines, sampleRules, 1);
    expect(violations.length).toBe(0);
  });

  // Test Case 7 (PASS): Mandatory receipt rule flags blocking violation when receipt threshold exceeded without receipt
  it('TC07_Policy: should flag BLOCKING violation when amount exceeds receipt threshold and no receipt is attached', () => {
    const lines = [
      { id: 'line-2', category: 'meals', amountPaise: 80000, receiptCount: 0 } // ₹800 > ₹500 threshold, 0 receipts
    ];
    const violations = PolicyService.evaluateLines(lines, sampleRules, 1);
    expect(violations.length).toBe(1);
    expect(violations[0].blocking).toBe(true);
  });

  // Test Case 8 (PASS): When receipt is attached, amount exceeding receipt threshold produces no receipt violation
  it('TC08_Policy: should not flag receipt violation when receipt is attached for amount above threshold', () => {
    const lines = [
      { id: 'line-3', category: 'travel', amountPaise: 300000, receiptCount: 1 } // ₹3,000 > ₹1,000 threshold, 1 receipt
    ];
    const violations = PolicyService.evaluateLines(lines, sampleRules, 1);
    expect(violations.length).toBe(0);
  });

  // Test Case 9 (PASS): Amount exceeding category spending limit flags NON-BLOCKING violation
  it('TC09_Policy: should flag NON-BLOCKING violation when line amount exceeds category spending limit', () => {
    const lines = [
      { id: 'line-4', category: 'travel', amountPaise: 600000, receiptCount: 1 } // ₹6,000 > ₹5,000 limit, 1 receipt
    ];
    const violations = PolicyService.evaluateLines(lines, sampleRules, 1);
    expect(violations.length).toBe(1);
    expect(violations[0].blocking).toBe(false);
  });

  // Test Case 10 (FAIL): Regular test case expecting non-blocking violation for over-limit claim,
  // but fails due to modified bug in PolicyService.evaluateLines
  it('TC10_Policy: should flag spending limit violation for meals over limit (Intended to FAIL due to introduced defect)', () => {
    const lines = [
      { id: 'line-5', category: 'meals', amountPaise: 200000, receiptCount: 1 } // ₹2,000 > ₹1,500 limit, 1 receipt
    ];
    const violations = PolicyService.evaluateLines(lines, sampleRules, 1);
    // Standard test expectation: ₹2000 exceeds ₹1500 limit, so 1 violation is expected
    expect(violations.length).toBe(1);
    expect(violations[0].blocking).toBe(false);
  });
});
