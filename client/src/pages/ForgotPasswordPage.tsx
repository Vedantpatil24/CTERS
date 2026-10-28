import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ message: string }>('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ identifier })
      });
      setMessage(res.message + ' (Check the Outbox tab for the reset code)');
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ message: string }>('/auth/complete-password-reset', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword })
      });
      alert(res.message);
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Reset Password</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          Password recovery for activated accounts
        </p>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequest}>
            <div className="form-group">
              <label>Employee ID or Official Email</label>
              <input
                type="text"
                className="form-control"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleComplete}>
            <div className="form-group">
              <label>Reset Code</label>
              <input
                type="text"
                className="form-control"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="≥8 characters, 1 number, 1 special symbol"
                required
              />
            </div>

            <button type="submit" className="btn btn-success" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};
