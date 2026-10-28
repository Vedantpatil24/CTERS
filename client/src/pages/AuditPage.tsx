import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionType, setActionType] = useState('');
  const [userId, setUserId] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (actionType) query.append('actionType', actionType);
    if (userId) query.append('userId', userId);

    apiRequest<any[]>(`/audit-logs?${query.toString()}`)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Audit Trail</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Immutable, database-enforced chronological audit records (FR-AUDIT-01..04)
          </p>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0, minWidth: '220px' }}>
          <label>Filter by Action</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. LOGIN, SUBMITTED, APPROVED"
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={fetchLogs}>
          Apply Filters
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setActionType('');
            setUserId('');
            fetchLogs();
          }}
        >
          Reset
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div>Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No audit log entries matching criteria.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor Email</th>
                <th>Action Type</th>
                <th>Record Type</th>
                <th>Prior Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td><small>{new Date(l.timestamp).toLocaleString()}</small></td>
                  <td><strong>{l.actorEmail || l.actorId || 'System'}</strong></td>
                  <td><code>{l.actionType}</code></td>
                  <td>{l.recordType}</td>
                  <td><small>{l.priorValue ? String(l.priorValue).slice(0, 80) : '—'}</small></td>
                  <td><small>{l.newValue ? String(l.newValue).slice(0, 80) : '—'}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
