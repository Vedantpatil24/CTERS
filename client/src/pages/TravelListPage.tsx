import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export const TravelListPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [justificationCategory, setJustificationCategory] = useState('Client Meeting');
  const [estimatedBudgetInr, setEstimatedBudgetInr] = useState('25000');
  const [shortNoticeReason, setShortNoticeReason] = useState('');
  const [overlapAcknowledged, setOverlapAcknowledged] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = () => {
    apiRequest<any[]>('/travel-requests?all=true')
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const budgetPaise = Math.round(parseFloat(estimatedBudgetInr) * 100);

    try {
      await apiRequest('/travel-requests', {
        method: 'POST',
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          purpose,
          justificationCategory,
          estimatedBudgetPaise: budgetPaise,
          shortNoticeReason,
          overlapAcknowledged
        })
      });
      setShowModal(false);
      // Reset form
      setDestination('');
      setPurpose('');
      setShortNoticeReason('');
      setOverlapAcknowledged(false);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to submit travel request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this travel request?')) return;
    try {
      await apiRequest(`/travel-requests/${id}/cancel`, { method: 'POST' });
      fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Cannot cancel request');
    }
  };

  // Filtered requests list
  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const dest = (r.destination || '').toLowerCase();
    const reqNo = (r.requestNo || '').toLowerCase();
    const empName = (r.user?.employeeMaster?.name || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || dest.includes(query) || reqNo.includes(query) || empName.includes(query);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Travel Requests</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage and track corporate business travel submissions (FR-TRAVEL-01..08)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Travel Request
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
              placeholder="🔍 Search request #, destination, employee..."
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
                <option value="ALL">All Statuses ({requests.length})</option>
                <option value="submitted">Submitted</option>
                <option value="clarification_requested">Clarification Requested</option>
                <option value="approved">Approved</option>
                <option value="booked">Booked</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
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
          <h3>Submit New Travel Request</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Will be routed to your designated Approving Manager for review.
          </p>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleCreate}>
            <div className="grid-2">
              <div className="form-group">
                <label>Destination City / Location *</label>
                <input
                  type="text"
                  className="form-control"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Bangalore Tech Center"
                  required
                />
              </div>

              <div className="form-group">
                <label>Justification Category</label>
                <select
                  className="form-control"
                  value={justificationCategory}
                  onChange={(e) => setJustificationCategory(e.target.value)}
                >
                  <option value="Client Meeting">Client Meeting</option>
                  <option value="Project Planning">Project Planning</option>
                  <option value="Conference">Conference / Seminar</option>
                  <option value="Training">Training &amp; Certification</option>
                  <option value="Internal Operations">Internal Operations</option>
                </select>
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label>Departure Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Return Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Estimated Total Budget (INR ₹) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={estimatedBudgetInr}
                  onChange={(e) => setEstimatedBudgetInr(e.target.value)}
                  placeholder="e.g. 25000"
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Business Purpose &amp; Justification *</label>
              <textarea
                className="form-control"
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Detailed explanation of the business necessity of this trip..."
                required
              />
            </div>

            <div className="form-group">
              <label>Short-Notice Justification (Required if departing within &lt; 5 business days)</label>
              <input
                type="text"
                className="form-control"
                value={shortNoticeReason}
                onChange={(e) => setShortNoticeReason(e.target.value)}
                placeholder="Reason why advance approval wasn't possible..."
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="overlapAck"
                checked={overlapAcknowledged}
                onChange={(e) => setOverlapAcknowledged(e.target.checked)}
              />
              <label htmlFor="overlapAck" style={{ margin: 0, fontWeight: 'normal', fontSize: '0.85rem' }}>
                I acknowledge and accept date overlap if another trip is active during this period.
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div>Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            {requests.length === 0 ? 'No travel requests found.' : 'No travel requests match the selected filters.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Request #</th>
                <th>Employee</th>
                <th>Destination</th>
                <th>Dates</th>
                <th>Estimated Budget</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.requestNo}</strong>
                    {r.flaggedForAdmin && (
                      <span className="badge badge-rejected" style={{ marginLeft: '0.5rem' }}>Overrun Flag</span>
                    )}
                  </td>
                  <td>{r.user?.employeeMaster?.name || 'Self'}</td>
                  <td>{r.destination}</td>
                  <td>
                    {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                  </td>
                  <td>₹{(r.estimatedBudgetPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link to={`/travel/${r.id}`} className="btn btn-secondary btn-sm">
                        View Details
                      </Link>
                      {(r.status === 'submitted' || r.status === 'clarification_requested') && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Cancel
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
