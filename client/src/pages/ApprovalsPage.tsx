import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';

export const ApprovalsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TRAVEL_REQUEST' | 'EXPENSE_CLAIM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Decision Modal state
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | 'CLARIFY'>('APPROVE');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = () => {
    apiRequest<any[]>('/approvals/pending')
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const openDecisionModal = (entry: any, dec: 'APPROVE' | 'REJECT' | 'CLARIFY') => {
    setSelectedItem(entry);
    setDecision(dec);
    setComment('');
    setError(null);
  };

  const handleDecide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/approvals/decide', {
        method: 'POST',
        body: JSON.stringify({
          entityType: selectedItem.type,
          entityId: selectedItem.item.id,
          decision,
          comment
        })
      });
      setSelectedItem(null);
      fetchPending();
    } catch (err: any) {
      setError(err.message || 'Decision failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isCommentMandatory = () => {
    if (decision === 'REJECT' || decision === 'CLARIFY') return true;
    if (decision === 'APPROVE' && selectedItem?.type === 'EXPENSE_CLAIM' && selectedItem?.item?.violations?.length > 0) {
      return true; // Approve despite flag requires justification (FR-POLICY-07)
    }
    return false;
  };

  const filteredItems = items.filter(({ type, item }) => {
    const matchesType = typeFilter === 'ALL' || type === typeFilter;
    const refNo = (item.requestNo || item.claimNo || '').toLowerCase();
    const empName = (item.user?.employeeMaster?.name || '').toLowerCase();
    const details = (item.destination || item.description || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || refNo.includes(query) || empName.includes(query) || details.includes(query);
    return matchesType && matchesSearch;
  });

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Management Approval Queue</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Review team travel requests and expense claims awaiting authorization (FR-APPR-01..07)
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <input
              type="text"
              className="form-control"
              style={{ maxWidth: '300px' }}
              placeholder="🔍 Search reference #, employee, destination..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Type:</label>
              <select
                className="form-control"
                style={{ width: 'auto' }}
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
              >
                <option value="ALL">All Items ({items.length})</option>
                <option value="TRAVEL_REQUEST">Travel Requests ({items.filter(i => i.type === 'TRAVEL_REQUEST').length})</option>
                <option value="EXPENSE_CLAIM">Expense Claims ({items.filter(i => i.type === 'EXPENSE_CLAIM').length})</option>
              </select>
            </div>
          </div>
          {(searchQuery || typeFilter !== 'ALL') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {selectedItem && (
        <div className="card" style={{ border: '2px solid var(--primary)', marginBottom: '2rem' }}>
          <h3>Submit Decision: {decision}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Reviewing {selectedItem.type === 'TRAVEL_REQUEST' ? 'Travel Request' : 'Expense Claim'} #{selectedItem.item.requestNo || selectedItem.item.claimNo} submitted by {selectedItem.item.user?.employeeMaster?.name}
          </p>

          {error && <div className="alert alert-danger">{error}</div>}

          {/* Show policy violation alert if approving with flags */}
          {selectedItem.type === 'EXPENSE_CLAIM' && selectedItem.item.violations?.length > 0 && (
            <div className="alert alert-warning">
              <strong>⚠️ Policy Violation Flags Detected (FR-POLICY-06):</strong>
              <ul style={{ marginLeft: '1.25rem', marginTop: '0.5rem' }}>
                {selectedItem.item.violations.map((v: any) => (
                  <li key={v.id}><strong>{v.category}:</strong> {v.description}</li>
                ))}
              </ul>
              {decision === 'APPROVE' && (
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                  Mandatory Requirement (FR-POLICY-07): A justification comment is required to approve despite flagged violations.
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleDecide}>
            <div className="form-group">
              <label>
                Decision Comment {isCommentMandatory() ? '(Mandatory)' : '(Optional)'}
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={isCommentMandatory() ? 'Provide required reason / justification...' : 'Optional comment...'}
                required={isCommentMandatory()}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                className={`btn ${decision === 'APPROVE' ? 'btn-success' : decision === 'REJECT' ? 'btn-danger' : 'btn-warning'}`}
                disabled={submitting}
              >
                {submitting ? 'Recording Decision...' : `Confirm ${decision}`}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedItem(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div>Loading pending approvals...</div>
        ) : filteredItems.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            {items.length === 0 ? 'No items currently pending your approval.' : 'No items match your filter criteria.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Reference #</th>
                <th>Employee</th>
                <th>Details</th>
                <th>Amount</th>
                <th>Violations</th>
                <th>Submission Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(({ approval, type, item }) => (
                <tr key={approval.id}>
                  <td>
                    <strong>{type === 'TRAVEL_REQUEST' ? 'Travel Request' : 'Expense Claim'}</strong>
                    {approval.level > 1 && (
                      <span className="badge badge-pending_approval" style={{ marginLeft: '0.4rem' }}>L{approval.level} Director</span>
                    )}
                  </td>
                  <td>
                    {type === 'TRAVEL_REQUEST' ? (
                      <Link to={`/travel/${item.id}`}><code>{item.requestNo}</code></Link>
                    ) : (
                      <Link to={`/claims/${item.id}`}><code>{item.claimNo}</code></Link>
                    )}
                  </td>
                  <td>{item.user?.employeeMaster?.name}</td>
                  <td>
                    {type === 'TRAVEL_REQUEST'
                      ? `${item.destination} (${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()})`
                      : item.description || 'Travel expenses'}
                  </td>
                  <td>
                    <strong>
                      ₹{((item.estimatedBudgetPaise || item.totalAmountPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td>
                    {item.violations && item.violations.length > 0 ? (
                      <span className="badge badge-flagged_for_correction">{item.violations.length} Flagged</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>None</span>
                    )}
                  </td>
                  <td>{new Date(approval.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => openDecisionModal({ approval, type, item }, 'APPROVE')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => openDecisionModal({ approval, type, item }, 'REJECT')}
                      >
                        Reject
                      </button>
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => openDecisionModal({ approval, type, item }, 'CLARIFY')}
                      >
                        Clarify
                      </button>
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
