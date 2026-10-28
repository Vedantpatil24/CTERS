import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export const FinancePage: React.FC = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected claims for batch creation
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);

  // Return modal
  const [returnClaimId, setReturnClaimId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');

  // Confirm modal
  const [confirmBatchId, setConfirmBatchId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [q, b] = await Promise.all([
        apiRequest<any[]>('/finance/claims-queue'),
        apiRequest<any[]>('/finance/batches')
      ]);
      setQueue(q);
      setBatches(b);
      setSelectedClaimIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerify = async (claimId: string) => {
    setError(null);
    try {
      await apiRequest(`/finance/claims/${claimId}/verify`, { method: 'POST' });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnClaimId) return;
    setError(null);
    try {
      await apiRequest(`/finance/claims/${returnClaimId}/return`, {
        method: 'POST',
        body: JSON.stringify({ reason: returnReason })
      });
      setReturnClaimId(null);
      setReturnReason('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to return claim');
    }
  };

  const handleToggleSelect = (claimId: string) => {
    if (selectedClaimIds.includes(claimId)) {
      setSelectedClaimIds(selectedClaimIds.filter(id => id !== claimId));
    } else {
      setSelectedClaimIds([...selectedClaimIds, claimId]);
    }
  };

  const handleCreateBatch = async () => {
    if (selectedClaimIds.length === 0) {
      alert('Select at least one claim marked "Ready for Disbursement"');
      return;
    }
    setError(null);
    setActionLoading(true);

    try {
      await apiRequest('/finance/batches', {
        method: 'POST',
        body: JSON.stringify({ claimIds: selectedClaimIds })
      });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Batch creation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = async (batchId: string, batchRef: string) => {
    setError(null);
    try {
      const blob = await apiRequest(`/finance/batches/${batchId}/export-csv`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${batchRef}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Export failed. (Check if simulateExportFailure is active in Admin Settings)');
    }
  };

  const handleConfirmDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmBatchId) return;
    setError(null);
    setActionLoading(true);

    try {
      await apiRequest(`/finance/batches/${confirmBatchId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ paymentReference })
      });
      setConfirmBatchId(null);
      setPaymentReference('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Disbursement confirmation failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance &amp; Reimbursement Portal</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Verify claims, assemble bank reimbursement batches, export CSV, and confirm disbursement (FR-REIMB-01..07)
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Return Claim Modal */}
      {returnClaimId && (
        <div className="card" style={{ border: '2px solid var(--danger)', marginBottom: '1.5rem' }}>
          <h3>Return Claim for Correction (FR-REIMB-06)</h3>
          <form onSubmit={handleReturn}>
            <div className="form-group">
              <label>State Audit / Correction Reason</label>
              <textarea
                className="form-control"
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Receipt unreadable; please re-upload clear GST tax bill."
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-danger">Return to Employee</button>
              <button type="button" className="btn btn-secondary" onClick={() => setReturnClaimId(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Disbursement Modal */}
      {confirmBatchId && (
        <div className="card" style={{ border: '2px solid var(--success)', marginBottom: '1.5rem' }}>
          <h3>Confirm Disbursement &amp; Mark Reimbursed (FR-REIMB-04..05)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            In one atomic transaction, all claims in this batch will be marked Reimbursed and notifications delivered.
          </p>
          <form onSubmit={handleConfirmDisbursement}>
            <div className="form-group">
              <label>Bank Payment Reference Number / UTR</label>
              <input
                type="text"
                className="form-control"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. NEFT-20261008-9842"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-success" disabled={actionLoading}>
                {actionLoading ? 'Processing...' : 'Confirm Bank Transfer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmBatchId(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Claims Verification Queue */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3>Claims Pending Finance Verification &amp; Batching</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Select verified claims to create a bank disbursement batch.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreateBatch}
            disabled={selectedClaimIds.length === 0 || actionLoading}
          >
            Create Reimbursement Batch ({selectedClaimIds.length})
          </button>
        </div>

        {loading ? (
          <div>Loading queue...</div>
        ) : queue.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No claims awaiting finance verification or batching.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Select</th>
                <th>Claim #</th>
                <th>Employee</th>
                <th>Bank Account</th>
                <th>Amount</th>
                <th>Violations</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.status === 'processed_by_finance' && (
                      <input
                        type="checkbox"
                        checked={selectedClaimIds.includes(c.id)}
                        onChange={() => handleToggleSelect(c.id)}
                      />
                    )}
                  </td>
                  <td><strong>{c.claimNo}</strong></td>
                  <td>{c.user?.employeeMaster?.name}</td>
                  <td><code>{c.user?.employeeMaster?.bankAccountRef || 'N/A'}</code></td>
                  <td><strong>₹{(c.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                  <td>
                    {c.violations?.length > 0 ? (
                      <span className="badge badge-flagged_for_correction">{c.violations.length} Flagged</span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>Clean</span>
                    )}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {c.status === 'approved' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleVerify(c.id)}
                        >
                          Verify &amp; Ready
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setReturnClaimId(c.id)}
                      >
                        Return
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reimbursement Batches Table */}
      <div className="card">
        <h3>Reimbursement Batches (FR-REIMB-03..05)</h3>
        {batches.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>No reimbursement batches generated yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Batch Reference</th>
                <th>Claims Count</th>
                <th>Total Volume</th>
                <th>Created At</th>
                <th>Status</th>
                <th>Disbursement Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td><code><strong>{b.batchRef}</strong></code></td>
                  <td>{b.claims?.length || 0} claims</td>
                  <td><strong>₹{(b.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                  <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleExportCsv(b.id, b.batchRef)}
                      >
                        📥 Export Bank CSV
                      </button>
                      {b.status !== 'confirmed' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => {
                            setConfirmBatchId(b.id);
                            setPaymentReference(`NEFT-${new Date().getTime().toString().slice(-8)}`);
                          }}
                        >
                          Confirm Disbursement
                        </button>
                      )}
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
