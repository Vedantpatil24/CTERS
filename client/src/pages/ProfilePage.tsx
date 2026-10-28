import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [bankAccountRef, setBankAccountRef] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchProfile = () => {
    apiRequest('/profile')
      .then((data) => {
        setProfile(data);
        setBankAccountRef(data.rawBankAccountRef || data.bankAccountRef || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const res = await apiRequest<{ message: string }>('/profile/bank', {
        method: 'PUT',
        body: JSON.stringify({ bankAccountRef, password })
      });
      setMessage(res.message);
      setPassword('');
      fetchProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to update bank details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="container card">Loading profile...</div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Employee Profile</h1>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Personal & Organization Details</h3>
          <table style={{ marginTop: 0 }}>
            <tbody>
              <tr><th style={{ width: '40%' }}>Employee ID</th><td>{profile.employeeId}</td></tr>
              <tr><th>Full Name</th><td>{profile.name}</td></tr>
              <tr><th>Official Email</th><td>{profile.officialEmail}</td></tr>
              <tr><th>Department</th><td>{profile.department}</td></tr>
              <tr><th>Designation</th><td>{profile.designation}</td></tr>
              <tr>
                <th>Designated Approving Manager (FR-PROF-05)</th>
                <td>
                  {profile.designatedManager ? (
                    <div>
                      <strong>{profile.designatedManager.name}</strong> ({profile.designatedManager.employeeId})
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {profile.designatedManager.designation} — {profile.designatedManager.department}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No designated manager assigned</span>
                  )}
                </td>
              </tr>
              <tr>
                <th>Assigned Roles</th>
                <td>{profile.roles.join(', ')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Reimbursement Bank Account (FR-PROF-02..04)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Current on file: <strong>{profile.bankAccountRef || 'None'}</strong>
          </p>

          {error && <div className="alert alert-danger">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          <form onSubmit={handleUpdateBank}>
            <div className="form-group">
              <label>Bank Account Reference / IBAN</label>
              <input
                type="text"
                className="form-control"
                value={bankAccountRef}
                onChange={(e) => setBankAccountRef(e.target.value)}
                placeholder="e.g. HDFC0001234567"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Account Password (Mandatory Re-Authentication)</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to authorize change"
                required
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Per company security policy, modifying banking details requires password verification and is audited.
              </small>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Updating...' : 'Save Bank Details'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
