import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export const ClaimDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Add Line Form
  const [category, setCategory] = useState('Meals');
  const [date, setDate] = useState('');
  const [amountInr, setAmountInr] = useState('1500');
  const [lineDesc, setLineDesc] = useState('');

  // Dry run result
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  // Errors / alerts
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Receipt Upload State
  const [uploadLineId, setUploadLineId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const fetchClaim = () => {
    apiRequest(`/claims/${id}`)
      .then(setClaim)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClaim();
  }, [id]);

  const isEditable = claim && (claim.status === 'draft' || claim.status === 'clarification_requested');

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setActionLoading(true);

    try {
      await apiRequest(`/claims/${id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          category,
          date,
          amountPaise: Math.round(parseFloat(amountInr) * 100),
          description: lineDesc
        })
      });
      setLineDesc('');
      setDryRunResult(null);
      fetchClaim();
    } catch (err: any) {
      setError(err.message || 'Failed to add expense item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!window.confirm('Remove this expense line item?')) return;
    try {
      await apiRequest(`/claims/${id}/lines/${lineId}`, { method: 'DELETE' });
      setDryRunResult(null);
      fetchClaim();
    } catch (err: any) {
      alert(err.message || 'Cannot remove line');
    }
  };

  const handleUploadReceipt = async (lineId: string) => {
    if (!receiptFile) {
      alert('Please choose a receipt file (JPEG, PNG, or PDF <= 5MB)');
      return;
    }
    setError(null);
    setActionLoading(true);

    const formData = new FormData();
    formData.append('file', receiptFile);

    try {
      await apiRequest(`/claims/${id}/lines/${lineId}/receipts`, {
        method: 'POST',
        body: formData
      });
      setUploadLineId(null);
      setReceiptFile(null);
      setDryRunResult(null);
      fetchClaim();
    } catch (err: any) {
      setError(err.message || 'Failed to upload receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveReceipt = async (lineId: string, receiptId: string) => {
    if (!window.confirm('Delete this receipt?')) return;
    try {
      await apiRequest(`/claims/${id}/lines/${lineId}/receipts/${receiptId}`, { method: 'DELETE' });
      setDryRunResult(null);
      fetchClaim();
    } catch (err: any) {
      alert(err.message || 'Cannot remove receipt');
    }
  };

  const handleValidateDryRun = async () => {
    setError(null);
    setValidating(true);
    try {
      const res = await apiRequest(`/claims/${id}/validate`, { method: 'POST' });
      setDryRunResult(res);
    } catch (err: any) {
      setError(err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!window.confirm('Submit this claim for policy validation and manager approval?')) return;
    setError(null);
    setSuccess(null);
    setActionLoading(true);

    try {
      await apiRequest(`/claims/${id}/submit`, { method: 'POST' });
      setSuccess('Expense claim submitted successfully! It has been routed to your manager.');
      setDryRunResult(null);
      fetchClaim();
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawClaim = async () => {
    if (!window.confirm('Withdraw this claim back to Draft status?')) return;
    setActionLoading(true);
    try {
      await apiRequest(`/claims/${id}/withdraw`, { method: 'POST' });
      fetchClaim();
    } catch (err: any) {
      alert(err.message || 'Cannot withdraw claim');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="container card">Loading claim details...</div>;
  if (!claim) return <div className="container card">Expense claim not found.</div>;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expense Claim {claim.claimNo}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Trip Reference: <strong>{claim.travelRequest?.requestNo}</strong> ({claim.travelRequest?.destination}) | Employee: <strong>{claim.user?.employeeMaster?.name}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <StatusBadge status={claim.status} />
          {claim.status === 'pending_approval' && (
            <button className="btn btn-warning btn-sm" onClick={handleWithdrawClaim} disabled={actionLoading}>
              Withdraw to Draft (FR-CLAIM-07)
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Claim Summary Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Total Claimed: <span style={{ color: 'var(--primary)' }}>₹{(claim.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Auto-calculated sum of all itemized entries (FR-CLAIM-03)
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {claim.policyVersionUsed && (
              <span className="badge badge-submitted" style={{ marginRight: '0.5rem' }}>Policy Rule v{claim.policyVersionUsed}</span>
            )}
            {claim.submittedAt && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Submitted: {new Date(claim.submittedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Policy Violations / Flags Card */}
      {claim.violations && claim.violations.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <h4 style={{ color: '#92400e', marginBottom: '0.5rem' }}>⚠️ Flagged Policy Violations (FR-POLICY-06)</h4>
          <ul style={{ marginLeft: '1.25rem' }}>
            {claim.violations.map((v: any) => (
              <li key={v.id} style={{ marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                <strong>{v.category}:</strong> {v.description} {v.blocking ? <span className="badge badge-rejected">Blocking</span> : <span className="badge badge-flagged_for_correction">Non-Blocking Flag</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Itemized Lines */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Itemized Expense Lines (FR-CLAIM-02)</h3>
          {isEditable && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Add items below. Receipts mandatory if item &gt; ₹1,000.
            </span>
          )}
        </div>

        {claim.lines?.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No expense lines added yet. Add at least one line before submitting.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Attached Receipts (FR-RCPT-01..02)</th>
                {isEditable && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {claim.lines?.map((line: any) => (
                <tr key={line.id}>
                  <td><strong>{line.category}</strong></td>
                  <td>{new Date(line.date).toLocaleDateString()}</td>
                  <td>{line.description || '—'}</td>
                  <td>
                    <strong>₹{(line.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    {line.amountPaise > 100000 && line.receipts.length === 0 && (
                      <span className="badge badge-rejected" style={{ marginLeft: '0.5rem' }}>Receipt Required</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {line.receipts?.map((r: any) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                          <span>📄 {r.fileName}</span>
                          <a
                            href={`/api/receipts/${r.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.1rem 0.35rem' }}
                          >
                            View
                          </a>
                          {isEditable && (
                            <button
                              onClick={() => handleRemoveReceipt(line.id, r.id)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.1rem 0.35rem' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}

                      {isEditable && line.receipts.length < 5 && (
                        <div>
                          {uploadLineId === line.id ? (
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                              <input
                                type="file"
                                accept=".jpeg,.jpg,.png,.pdf"
                                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                                style={{ fontSize: '0.8rem' }}
                              />
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => handleUploadReceipt(line.id)}
                                disabled={actionLoading}
                              >
                                Upload
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setUploadLineId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setUploadLineId(line.id)}
                              style={{ marginTop: '0.25rem' }}
                            >
                              + Attach Receipt
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  {isEditable && (
                    <td>
                      <button
                        onClick={() => handleRemoveLine(line.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add Line Form if editable */}
        {isEditable && (
          <form onSubmit={handleAddLine} style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '4px' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Add Expense Item</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 140px 140px 1fr 100px', gap: '0.5rem', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Category</label>
                <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Meals">Meals</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Local Transport">Local Transport</option>
                  <option value="Flight">Flight</option>
                  <option value="Conference">Conference</option>
                  <option value="Misc">Misc</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Date Incurred</label>
                <input
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Amount (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={amountInr}
                  onChange={(e) => setAmountInr(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Item Description</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Lunch with client partner"
                  value={lineDesc}
                  onChange={(e) => setLineDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                + Add Item
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Policy Pre-Validation Dry Run and Final Submission Actions */}
      {isEditable && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Policy Engine Validation &amp; Submission</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Run dry-run check to verify category spending limits and mandatory receipts prior to submission.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleValidateDryRun}
                disabled={validating || claim.lines?.length === 0}
              >
                {validating ? 'Evaluating...' : 'Dry-Run Policy Check (FR-POLICY-05)'}
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={handleSubmitClaim}
                disabled={actionLoading || claim.lines?.length === 0}
              >
                {actionLoading ? 'Submitting...' : 'Submit Claim to Manager (FR-CLAIM-05)'}
              </button>
            </div>
          </div>

          {dryRunResult && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid var(--border)' }}>
              <h4>Validation Results (Policy v{dryRunResult.activeVersion}):</h4>
              {dryRunResult.violations.length === 0 ? (
                <div style={{ color: 'var(--success)', marginTop: '0.5rem', fontWeight: 600 }}>
                  ✅ 100% Policy Compliant! All items within spending limits with valid receipts.
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem' }}>
                  {dryRunResult.hasBlocking ? (
                    <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '0.5rem' }}>
                      🚫 Blocking Violations Detected: Missing mandatory receipts will prevent final submission.
                    </div>
                  ) : (
                    <div style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: '0.5rem' }}>
                      ⚠️ Non-blocking flags detected: Claim can be submitted, but manager will need to justify override.
                    </div>
                  )}

                  <ul style={{ marginLeft: '1.25rem' }}>
                    {dryRunResult.violations.map((v: any, idx: number) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        <strong>{v.category}:</strong> {v.description} {v.blocking ? <span className="badge badge-rejected">Blocking</span> : <span className="badge badge-flagged_for_correction">Non-Blocking</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reimbursement Details if Reimbursed */}
      {claim.reimbursement && (
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <h3 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Disbursement Confirmed (FR-REIMB-04..05)</h3>
          <table>
            <tbody>
              <tr><th>Payment Reference</th><td><code>{claim.reimbursement.paymentReference}</code></td></tr>
              <tr><th>Disbursed Amount</th><td><strong>₹{(claim.reimbursement.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td></tr>
              <tr><th>Payment Date</th><td>{new Date(claim.reimbursement.paymentDate).toLocaleDateString()}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <Link to="/claims">← Back to Expense Claims</Link>
      </div>
    </div>
  );
};
