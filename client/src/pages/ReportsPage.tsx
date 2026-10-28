import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export const ReportsPage: React.FC = () => {
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [reportData, setReportData] = useState<any[]>([]);
  const [violationSummary, setViolationSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (department) query.append('department', department);
    if (status) query.append('status', status);
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);

    try {
      const res = await apiRequest(`/reports/travel-expense?${query.toString()}`);
      setReportData(res.claims || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchViolations = async () => {
    try {
      const res = await apiRequest('/reports/policy-violations');
      setViolationSummary(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReport();
    fetchViolations();
  }, []);

  const handleExportCsv = async () => {
    const query = new URLSearchParams();
    if (department) query.append('department', department);
    if (status) query.append('status', status);
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    query.append('exportCsv', 'true');

    try {
      const blob = await apiRequest(`/reports/travel-expense?${query.toString()}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'travel_expense_report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV report');
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports &amp; Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Filterable travel &amp; expense reports, CSV export, and policy compliance frequency (FR-REPORT-01..04)
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExportCsv}>
          📥 Export Filtered Report (CSV)
        </button>
      </div>

      {/* Policy Violations Summary Card (FR-REPORT-04) */}
      {violationSummary && (
        <div className="card">
          <h3>Policy Violation Analytics Summary (FR-REPORT-04)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            System-wide frequency analysis of non-blocking spending flags and missing receipts
          </p>
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-num">{violationSummary.totalViolations}</div>
              <div className="stat-label">Total Flagged Violations</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ color: 'var(--danger)' }}>{violationSummary.blockingCount}</div>
              <div className="stat-label">Blocking (Missing Receipts)</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ color: 'var(--warning)' }}>{violationSummary.nonBlockingCount}</div>
              <div className="stat-label">Non-Blocking (Limit Exceeded)</div>
            </div>
          </div>

          <h4>Violation Frequency by Category:</h4>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {Object.entries(violationSummary.categoryFrequency || {}).map(([cat, cnt]: any) => (
              <div key={cat} style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                <strong>{cat}:</strong> {cnt} occurrence(s)
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Department</label>
          <select className="form-control" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Marketing">Marketing</option>
            <option value="Sales">Sales</option>
            <option value="Support">Support</option>
            <option value="IT">IT</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>Status</label>
          <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="processed_by_finance">Ready for Disbursement</option>
            <option value="reimbursed">Reimbursed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>From Date</label>
          <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>To Date</label>
          <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <button className="btn btn-primary" onClick={fetchReport}>Apply Filters</button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setDepartment('');
            setStatus('');
            setStartDate('');
            setEndDate('');
            fetchReport();
          }}
        >
          Reset
        </button>
      </div>

      {/* Report Data Table */}
      <div className="card">
        <h3>Report Dataset ({reportData.length} records)</h3>
        {loading ? (
          <div>Loading report...</div>
        ) : reportData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No records matching current filter.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Trip Request #</th>
                <th>Total Claimed</th>
                <th>Violations</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.claimNo}</strong></td>
                  <td>{c.user?.employeeMaster?.name}</td>
                  <td>{c.user?.employeeMaster?.department}</td>
                  <td><code>{c.travelRequest?.requestNo}</code></td>
                  <td><strong>₹{(c.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                  <td>
                    {c.violations?.length > 0 ? (
                      <span className="badge badge-flagged_for_correction">{c.violations.length} Flagged</span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>0</span>
                    )}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
