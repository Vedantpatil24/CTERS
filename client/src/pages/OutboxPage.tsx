import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export const OutboxPage: React.FC = () => {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOutbox = () => {
    apiRequest<any[]>('/outbox')
      .then(setEmails)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOutbox();
    const interval = setInterval(fetchOutbox, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Simulated Email Outbox</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Live inspection of all system-dispatched emails, OTP codes, reset tokens, and notifications (Auto-refreshes every 4s)
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchOutbox}>
          🔄 Refresh Outbox
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div>Loading outbox...</div>
        ) : emails.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No emails in the outbox yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Sent At</th>
                <th style={{ width: '220px' }}>Recipient Email</th>
                <th style={{ width: '250px' }}>Subject</th>
                <th>Message Content</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((m) => (
                <tr key={m.id}>
                  <td><small>{new Date(m.sentAt).toLocaleTimeString()} ({new Date(m.sentAt).toLocaleDateString()})</small></td>
                  <td><strong>{m.recipientEmail}</strong></td>
                  <td><span style={{ color: 'var(--primary)', fontWeight: 600 }}>{m.subject}</span></td>
                  <td>
                    <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      {m.body}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
