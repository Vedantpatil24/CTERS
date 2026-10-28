import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export const BookingQueuePage: React.FC = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [activeReq, setActiveReq] = useState<any>(null);
  const [components, setComponents] = useState<any[]>([
    { type: 'flight', vendor: 'IndiGo', bookingReference: '', actualCostInr: '12000' }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = () => {
    apiRequest<any[]>('/bookings/queue')
      .then(setQueue)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const addComponentRow = () => {
    setComponents([
      ...components,
      { type: 'hotel', vendor: '', bookingReference: '', actualCostInr: '0' }
    ]);
  };

  const removeComponentRow = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: string, val: string) => {
    const copy = [...components];
    copy[index][field] = val;
    setComponents(copy);
  };

  const handleRecordItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReq) return;
    setError(null);
    setSubmitting(true);

    const payload = components.map(c => ({
      type: c.type,
      vendor: c.vendor,
      bookingReference: c.bookingReference,
      actualCostPaise: Math.round(parseFloat(c.actualCostInr || '0') * 100)
    }));

    try {
      await apiRequest(`/bookings/travel-requests/${activeReq.id}/itinerary`, {
        method: 'POST',
        body: JSON.stringify({ components: payload })
      });
      setActiveReq(null);
      fetchQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to record itinerary');
    } finally {
      setSubmitting(false);
    }
  };

  const currentTotalInr = components.reduce((sum, c) => sum + (parseFloat(c.actualCostInr) || 0), 0);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Travel Desk Booking Queue</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Confirmed itinerary coordination for approved employee business trips (FR-BOOK-01..06)
          </p>
        </div>
      </div>

      {activeReq && (
        <div className="card" style={{ border: '2px solid var(--primary)', marginBottom: '2rem' }}>
          <h3>Record Itinerary: Request #{activeReq.requestNo}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Destination: <strong>{activeReq.destination}</strong> | Employee: <strong>{activeReq.user?.employeeMaster?.name}</strong> | Estimated Budget: <strong>₹{(activeReq.estimatedBudgetPaise / 100).toFixed(2)}</strong>
          </p>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleRecordItinerary}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600 }}>Itinerary Components (Flights, Hotels, Transit)</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addComponentRow}>
                  + Add Component
                </button>
              </div>

              {components.map((c, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 120px 40px', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    className="form-control"
                    value={c.type}
                    onChange={(e) => updateComponent(idx, 'type', e.target.value)}
                  >
                    <option value="flight">Flight</option>
                    <option value="train">Train</option>
                    <option value="hotel">Hotel</option>
                    <option value="local">Local Transit</option>
                  </select>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Vendor (e.g. IndiGo, Marriott)"
                    value={c.vendor}
                    onChange={(e) => updateComponent(idx, 'vendor', e.target.value)}
                    required
                  />

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Booking Ref / PNR"
                    value={c.bookingReference}
                    onChange={(e) => updateComponent(idx, 'bookingReference', e.target.value)}
                    required
                  />

                  <input
                    type="number"
                    className="form-control"
                    placeholder="Cost (₹)"
                    value={c.actualCostInr}
                    onChange={(e) => updateComponent(idx, 'actualCostInr', e.target.value)}
                    required
                  />

                  {components.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeComponentRow(idx)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px' }}>
              <strong>Total Actual Cost: ₹{currentTotalInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              {currentTotalInr > (activeReq.estimatedBudgetPaise / 100) * 1.2 && (
                <span style={{ color: 'var(--danger)', marginLeft: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ Exceeds estimated budget by &gt;20%! Will be flagged for Administrator review.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Confirming...' : 'Record Itinerary & Mark Booked'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveReq(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div>Loading booking queue...</div>
        ) : queue.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No approved requests waiting for booking.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Request #</th>
                <th>Employee</th>
                <th>Destination</th>
                <th>Travel Dates</th>
                <th>Estimated Budget</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.requestNo}</strong></td>
                  <td>{r.user?.employeeMaster?.name}</td>
                  <td>{r.destination}</td>
                  <td>
                    {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                  </td>
                  <td>₹{(r.estimatedBudgetPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setActiveReq(r);
                        setComponents([
                          { type: 'flight', vendor: 'Air India', bookingReference: '', actualCostInr: ((r.estimatedBudgetPaise * 0.5) / 100).toString() },
                          { type: 'hotel', vendor: 'Taj Gateway', bookingReference: '', actualCostInr: ((r.estimatedBudgetPaise * 0.4) / 100).toString() }
                        ]);
                      }}
                    >
                      Book Itinerary
                    </button>
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
