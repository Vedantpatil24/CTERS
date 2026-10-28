import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';

export const ActivatePage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [employeeId, setEmployeeId] = useState('EMP012'); // Default to unactivated demo employee
  const [officialEmail, setOfficialEmail] = useState('newjoiner@cters.corp');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ message: string }>('/auth/request-activation', {
        method: 'POST',
        body: JSON.stringify({ employeeId, officialEmail })
      });
      setMessage(res.message + ' (Check the Outbox tab to view the generated email OTP!)');
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/auth/complete-activation', {
        method: 'POST',
        body: JSON.stringify({ employeeId, otp, password })
      });
      alert(res.message);
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Employee Identity Verification</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          Mandatory HR verification for first-time account activation
        </p>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label>Official Employee ID</label>
              <input
                type="text"
                className="form-control"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP012"
                required
              />
            </div>

            <div className="form-group">
              <label>Registered Corporate Email</label>
              <input
                type="email"
                className="form-control"
                value={officialEmail}
                onChange={(e) => setOfficialEmail(e.target.value)}
                placeholder="e.g. newjoiner@cters.corp"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Verifying with HR Master...' : 'Verify Details & Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompleteActivation}>
            <div className="form-group">
              <label>6-Digit Verification OTP</label>
              <input
                type="text"
                className="form-control"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP from email"
                required
              />
            </div>

            <div className="form-group">
              <label>Create Secure Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="≥8 characters, 1 number, 1 special char"
                required
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Must be at least 8 characters long with at least 1 number and 1 special symbol (!@#$%^&*).
              </small>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-success" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Activating Account...' : 'Set Password & Activate'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => setStep(1)}
            >
              Back to Verification
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem' }}>
          Already activated? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
};
