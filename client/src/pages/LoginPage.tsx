import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('emp1@cters.corp');
  const [password, setPassword] = useState('Demo@1234');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiRequest<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickId: string) => {
    setIdentifier(quickId);
    setPassword('Demo@1234');
  };

  return (
    <div style={{ maxWidth: '440px', margin: '4rem auto', padding: '0 1rem' }}>
      <div className="card">
        <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>CTERS Login</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          Corporate Travel & Expense Reimbursement System
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
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

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <Link to="/activate">Activate Account (First-Time)</Link>
          <Link to="/forgot-password">Forgot Password?</Link>
        </div>

        <div className="quick-demo-panel">
          <strong>⚡ One-Click Demo Role Switcher:</strong>
          <div className="quick-demo-buttons">
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('admin@cters.corp')}>Admin</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('mgr1@cters.corp')}>Manager 1</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('mgr2@cters.corp')}>Manager 2</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('emp1@cters.corp')}>Employee 1</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('emp2@cters.corp')}>Employee 2</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('travel1@cters.corp')}>Travel Desk</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('fin1@cters.corp')}>Finance</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleQuickLogin('auditor1@cters.corp')}>Auditor</button>
          </div>
        </div>
      </div>
    </div>
  );
};
