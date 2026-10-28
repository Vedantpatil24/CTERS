import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export const ClaimsListPage: React.FC = () => {
  const location = useLocation();
  const preselectedTravelId = (location.state as any)?.travelRequestId;

  const [claims, setClaims] = useState<any[]>([]);
  const [bookedTravels, setBookedTravels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New claim modal
  const [showModal, setShowModal] = useState(false);
  const [selectedTravelId, setSelectedTravelId] = useState(preselectedTravelId || '');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [cList, tList] = await Promise.all([
        apiRequest<any[]>('/claims?all=true'),
        apiRequest<any[]>('/travel-requests')
      ]);
      setClaims(cList);
      // Filter for booked or completed trips eligible for claim creation (BR-2)
      setBookedTravels(tList.filter(t => t.status === 'booked' || t.status === 'completed'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (preselectedTravelId) {
      setShowModal(true);
      setSelectedTravelId(preselectedTravelId);
    }
  }, [preselectedTravelId]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const claim = await apiRequest('/claims', {
        method: 'POST',
        body: JSON.stringify({
          travelRequestId: selectedTravelId,
          description
        })
      });
      setShowModal(false);
      window.location.href = `/claims/${claim.id}`;
    } catch (err: any) {
      setError(err.message || 'Failed to create claim');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClaims = claims.filter(c => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const claimNo = (c.claimNo || '').toLowerCase();
    const tripNo = (c.travelRequest?.requestNo || '').toLowerCase();
    const empName = (c.user?.employeeMaster?.name || '').toLowerCase();
    const desc = (c.description || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || claimNo.includes(query) || tripNo.includes(query) || empName.includes(query) || desc.includes(query);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expense Claims</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Itemized reimbursement claims with receipts & policy validation (FR-CLAIM-01..07)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Create New Claim
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <input
              type="text"
              className="form-control"
              style={{ maxWidth: '300px' }}
              placeholder="🔍 Search claim #, trip #, employee, memo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Status:</label>
              <select
                className="form-control"
                style={{ width: 'auto' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses ({claims.length})</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="clarification_requested">Clarification Requested</option>
                <option value="processed_by_finance">Processed by Finance</option>
                <option value="batched">Batched</option>
                <option value="reimbursed">Reimbursed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          {(searchQuery || statusFilter !== 'ALL') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <div className="card" style={{ border: '2px solid var(--primary)', marginBottom: '2rem' }}>
          <h3>Initiate Expense Claim Draft</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Per Rule BR-2 &amp; BR-3: Every claim must link to an approved and booked business trip.
          </p>

          {error && <div className="alert alert-danger">{error}</div>}

          {bookedTravels.length === 0 ? (
            <div className="alert alert-warning">
              You do not currently have any trips in <strong>Booked</strong> or <strong>Completed</strong> status.
              <br />
              Please wait until your approved travel request has an itinerary confirmed by the Travel Desk.
            </div>
          ) : (
            <form onSubmit={handleCreateDraft}>
              <div className="form-group">
                <label>Select Confirmed Trip</label>
                <select
                  className="form-control"
                  value={selectedTravelId}
                  onChange={(e) => setSelectedTravelId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Booked Travel Request --</option>
                  {bookedTravels.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.requestNo} — {t.destination} ({new Date(t.startDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Claim Description / Memo</label>
                <input
                  type="text"
                  className="form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Onsite deployment incidental expenses"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting || !selectedTravelId}>
                  {submitting ? 'Creating...' : 'Create Draft & Add Items'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div>Loading claims...</div>
        ) : filteredClaims.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            {claims.length === 0 ? 'No expense claims found.' : 'No expense claims match the selected filters.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Trip Request #</th>
                <th>Employee</th>
                <th>Description</th>
                <th>Total Claimed</th>
                <th>Policy Status</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.claimNo}</strong></td>
                  <td><code>{c.travelRequest?.requestNo}</code></td>
                  <td>{c.user?.employeeMaster?.name || 'Self'}</td>
                  <td>{c.description || 'Travel expenses'}</td>
                  <td>
                    <strong>₹{(c.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </td>
                  <td>
                    {c.violations && c.violations.length > 0 ? (
                      <span className="badge badge-flagged_for_correction">
                        {c.violations.length} Violation Flag(s)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Compliant</span>
                    )}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <Link to={`/claims/${c.id}`} className="btn btn-secondary btn-sm">
                      View / Manage
                    </Link>
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
