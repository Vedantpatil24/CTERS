import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export const TravelDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [req, setReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit fields
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [budgetInr, setBudgetInr] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const fetchDetail = () => {
    apiRequest(`/travel-requests/${id}`)
      .then((data: any) => {
        setReq(data);
        setDestination(data.destination);
        setPurpose(data.purpose);
        setBudgetInr((data.estimatedBudgetPaise / 100).toString());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/travel-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          destination,
          purpose,
          estimatedBudgetPaise: Math.round(parseFloat(budgetInr) * 100)
        })
      });
      setEditing(false);
      fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Update failed');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this travel request?')) return;
    try {
      await apiRequest(`/travel-requests/${id}/cancel`, { method: 'POST' });
      fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Cancel failed');
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentError(null);
    setAttachmentUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('cters_token');
      const res = await fetch(`/api/travel-requests/${id}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || 'Upload failed');
      }
      fetchDetail();
    } catch (err: any) {
      setAttachmentError(err.message || 'Upload failed');
    } finally {
      setAttachmentUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Remove this attachment?')) return;
    try {
      await apiRequest(`/travel-requests/${id}/attachments/${attachmentId}`, { method: 'DELETE' });
      fetchDetail();
    } catch (err: any) {
      setAttachmentError(err.message || 'Delete failed');
    }
  };

  const downloadAttachment = (attachmentId: string, fileName: string) => {
    const token = localStorage.getItem('cters_token');
    const url = `/api/travel-requests/${id}/attachments/${attachmentId}/download`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
      });
  };

  if (loading) return <div className="container card">Loading travel details...</div>;
  if (!req) return <div className="container card">Travel request not found.</div>;

  const isOwner = req.user?.id === user?.id;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Travel Request {req.requestNo}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Requested by {req.user?.employeeMaster?.name} ({req.user?.employeeMaster?.department})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(req.status === 'submitted' || req.status === 'clarification_requested') && !editing && isOwner && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              ✏️ Edit / Resubmit
            </button>
          )}
          {(req.status === 'submitted' || req.status === 'clarification_requested') && isOwner && (
            <button className="btn btn-danger" onClick={handleCancel}>
              🚫 Cancel Request
            </button>
          )}
          {(req.status === 'booked' || req.status === 'completed') && (
            <button
              className="btn btn-success"
              onClick={() => navigate('/claims', { state: { travelRequestId: req.id } })}
            >
              + Create Expense Claim
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {editing ? (
        <div className="card">
          <h3>Edit Travel Request (FR-TRAVEL-05)</h3>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Destination</label>
              <input
                type="text"
                className="form-control"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Estimated Total Budget (INR ₹)</label>
              <input
                type="number"
                className="form-control"
                value={budgetInr}
                onChange={(e) => setBudgetInr(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Purpose / Details</label>
              <textarea
                className="form-control"
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">Save & Resubmit</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid-2">
          {/* ─── Request Summary ─── */}
          <div className="card">
            <h3>Request Summary</h3>
            <table>
              <tbody>
                <tr><th>Destination</th><td><strong>{req.destination}</strong></td></tr>
                <tr><th>Start Date</th><td>{new Date(req.startDate).toLocaleDateString()}</td></tr>
                <tr><th>End Date</th><td>{new Date(req.endDate).toLocaleDateString()}</td></tr>
                <tr><th>Justification</th><td>{req.justificationCategory || 'N/A'}</td></tr>
                <tr>
                  <th>Estimated Budget</th>
                  <td><strong>₹{(req.estimatedBudgetPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>
                    <StatusBadge status={req.status} />
                    {req.flaggedForAdmin && (
                      <span className="badge badge-rejected" style={{ marginLeft: '0.5rem' }}>Budget Overrun</span>
                    )}
                  </td>
                </tr>
                <tr><th>Purpose</th><td>{req.purpose}</td></tr>
                {req.shortNoticeReason && (
                  <tr><th>Short Notice Reason</th><td>{req.shortNoticeReason}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ─── Confirmed Itinerary ─── */}
          <div className="card">
            <h3>Confirmed Itinerary (FR-BOOK-05)</h3>
            {!req.itinerary ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
                {req.status === 'approved'
                  ? 'Approved — awaiting Travel Desk itinerary booking.'
                  : 'Itinerary recorded by Travel Desk once approved.'}
              </p>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', marginTop: '0.5rem' }}>
                  <span>Recorded: {new Date(req.itinerary.recordedAt).toLocaleDateString()}</span>
                  <span>
                    Total Cost: <strong>₹{(req.itinerary.totalCostPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Vendor</th>
                      <th>Reference #</th>
                      <th>Actual Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {req.itinerary.components?.map((c: any) => (
                      <tr key={c.id}>
                        <td style={{ textTransform: 'capitalize' }}><strong>{c.type}</strong></td>
                        <td>{c.vendor}</td>
                        <td><code>{c.bookingReference}</code></td>
                        <td>₹{(c.actualCostPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Supporting Documents / Attachments ─── */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Supporting Documents (FR-TRAVEL-09)</h3>
          {isOwner && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleUploadAttachment}
              />
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachmentUploading}
              >
                {attachmentUploading ? 'Uploading...' : '📎 Attach Document'}
              </button>
            </div>
          )}
        </div>

        {attachmentError && <div className="alert alert-danger" style={{ marginTop: '0.5rem' }}>{attachmentError}</div>}

        {(!req.attachments || req.attachments.length === 0) ? (
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No supporting documents attached yet.</p>
        ) : (
          <table style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {req.attachments.map((att: any) => (
                <tr key={att.id}>
                  <td>📄 {att.fileName}</td>
                  <td><code>{att.fileType}</code></td>
                  <td>{(att.fileSizeBytes / 1024).toFixed(1)} KB</td>
                  <td>{new Date(att.uploadedAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginRight: '0.25rem' }}
                      onClick={() => downloadAttachment(att.id, att.fileName)}
                    >
                      ⬇ Download
                    </button>
                    {isOwner && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => handleDeleteAttachment(att.id)}
                      >
                        🗑 Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Associated Claims ─── */}
      {req.claims && req.claims.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3>Associated Expense Claims</h3>
          <table>
            <thead>
              <tr><th>Claim No</th><th>Status</th><th>Lines</th></tr>
            </thead>
            <tbody>
              {req.claims.map((c: any) => (
                <tr key={c.id}>
                  <td><Link to={`/claims/${c.id}`}>{c.claimNo}</Link></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.lines?.length || 0} expense lines</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <Link to="/travel">← Back to Travel Requests</Link>
      </div>
    </div>
  );
};
