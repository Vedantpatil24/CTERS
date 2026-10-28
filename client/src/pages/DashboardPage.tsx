import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';

export const DashboardPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/reports/dashboard-summary')
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const isPureEmployee = user.roles.length === 1 && user.roles[0] === 'EMPLOYEE';
  const isManager = hasRole('APPROVING_MANAGER');
  const isTravelDesk = hasRole('TRAVEL_DESK');
  const isFinance = hasRole('FINANCE');
  const isAdmin = hasRole('ADMIN');
  const isAuditor = hasRole('AUDITOR') && !isAdmin;

  const officerRole = user.roles.find(r => r !== 'EMPLOYEE') || 'EMPLOYEE';

  return (
    <div className="container">
      {/* Role-Specific Hero Header */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <div className="hero-role-tag">
            <span className="dot"></span>
            {officerRole.replace('_', ' ')} WORKSPACE
          </div>
          <h1 className="hero-title">Welcome back, {user.name}</h1>
          <p className="hero-subtitle">
            {user.designation} &bull; {user.department} Department &bull; ID: <code>{user.employeeId}</code>
          </p>
        </div>

        {/* Action Callouts strictly tailored to the specific role */}
        <div className="hero-actions">
          {isPureEmployee && (
            <>
              <Link to="/travel" className="btn btn-primary shadow-btn">+ Raise Travel Request</Link>
              <Link to="/claims" className="btn btn-secondary shadow-btn">+ Submit Expense Claim</Link>
            </>
          )}

          {isManager && (
            <Link to="/approvals" className="btn btn-warning shadow-btn">
              📋 Review Pending Queue ({summary?.manager?.totalPendingApprovals || 0})
            </Link>
          )}

          {isTravelDesk && (
            <Link to="/bookings" className="btn btn-primary shadow-btn" style={{ background: '#7c3aed' }}>
              🎫 Book Itineraries ({summary?.travelDesk?.pendingBookingCount || 0})
            </Link>
          )}

          {isFinance && (
            <Link to="/finance" className="btn btn-success shadow-btn">
              💳 Manage Batches ({summary?.finance?.readyCount || 0})
            </Link>
          )}

          {isAuditor && (
            <Link to="/audit" className="btn btn-primary shadow-btn" style={{ background: '#0284c7' }}>
              🛡️ Audit Log Review
            </Link>
          )}

          {isAdmin && (
            <Link to="/admin" className="btn btn-primary shadow-btn">
              ⚙️ Admin Operations Console
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card loading-card">
          <div className="spinner"></div>
          <p>Loading your personal workspace metrics...</p>
        </div>
      ) : (
        <div className="dashboard-body">
          {/* 1. EMPLOYEE DASHBOARD */}
          {isPureEmployee && summary?.employee && (
            <div className="portal-section">
              <div className="section-header">
                <h2>✈️ Employee Travel &amp; Expense Hub</h2>
                <p>Track your business trips, itinerary bookings, and pending reimbursement disbursements.</p>
              </div>

              <div className="grid-2">
                <div className="card metric-card">
                  <div className="metric-icon travel-icon">🛫</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.employee.activeTravelCount}</div>
                    <div className="stat-label">Active Travel Requests</div>
                    <Link to="/travel" className="metric-link">Manage My Travel Requests &rarr;</Link>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon claim-icon">🧾</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.employee.activeClaimsCount}</div>
                    <div className="stat-label">Active Expense Claims</div>
                    <Link to="/claims" className="metric-link">Manage My Expense Claims &rarr;</Link>
                  </div>
                </div>
              </div>

              {/* Instructions banner for employees */}
              <div className="card tips-banner">
                <h3>💡 Quick Employee Guidance</h3>
                <ul>
                  <li><strong>Advance Notice:</strong> Submit travel requests at least 5 business days prior to departure.</li>
                  <li><strong>Receipt Rules:</strong> Mandatory receipts required for any expense item exceeding ₹1,000.</li>
                  <li><strong>Itinerary Booking:</strong> Once approved, the Travel Desk books flights and hotel components.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 2. APPROVING MANAGER DASHBOARD */}
          {isManager && summary?.manager && (
            <div className="portal-section">
              <div className="section-header">
                <h2>📋 Approving Manager Authorization Center</h2>
                <p>Review and authorize team travel plans and post-travel expense claims.</p>
              </div>

              <div className="grid-3">
                <div className="card metric-card highlight-metric">
                  <div className="metric-icon warning-icon">⏳</div>
                  <div className="metric-data">
                    <div className="stat-num text-warning">{summary.manager.totalPendingApprovals}</div>
                    <div className="stat-label">Total Awaiting My Decision</div>
                    <Link to="/approvals" className="metric-link font-bold">Open Review Queue &rarr;</Link>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon travel-icon">✈️</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.manager.pendingTravelApprovals}</div>
                    <div className="stat-label">Travel Requests Pending</div>
                    <span className="metric-sublabel">Awaiting schedule &amp; budget sign-off</span>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon claim-icon">📄</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.manager.pendingClaimApprovals}</div>
                    <div className="stat-label">Expense Claims Pending</div>
                    <span className="metric-sublabel">Flagged policy violations inspection</span>
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: '1rem' }}>
                <div className="card tips-banner">
                  <h3>⚖️ Policy &amp; Escalation Rules</h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569' }}>
                    &bull; Self-approval is strictly blocked.<br />
                    &bull; Travel requests &gt; ₹50,000 or Claims &gt; ₹25,000 automatically route to Executive Director (Level 2).<br />
                    &bull; Approvals with policy violations require a mandatory justification comment.
                  </p>
                </div>
                <div className="card tips-banner" style={{ background: '#f8fafc' }}>
                  <h3>📊 Analytics &amp; Reports</h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem' }}>
                    Generate detailed expense breakdown and team travel spending reports.
                  </p>
                  <Link to="/reports" className="btn btn-secondary btn-sm">Open Reports Module &rarr;</Link>
                </div>
              </div>
            </div>
          )}

          {/* 3. TRAVEL DESK DASHBOARD */}
          {isTravelDesk && summary?.travelDesk && (
            <div className="portal-section">
              <div className="section-header">
                <h2>🎫 Travel Desk Itinerary Booking Operations</h2>
                <p>Confirm flight reservations, hotel stays, and ground transport for approved corporate travel.</p>
              </div>

              <div className="grid-2">
                <div className="card metric-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <div className="metric-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>🎟️</div>
                  <div className="metric-data">
                    <div className="stat-num" style={{ color: '#7c3aed' }}>{summary.travelDesk.pendingBookingCount}</div>
                    <div className="stat-label">Approved Trips Ready for Itinerary Booking</div>
                    <Link to="/bookings" className="metric-link" style={{ color: '#7c3aed' }}>
                      Open Travel Booking Queue &rarr;
                    </Link>
                  </div>
                </div>

                <div className="card tips-banner" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <h3>📌 Coordinator Operations Guide</h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569' }}>
                    Record vendor confirmations (PNR, Ticket #, Booking Ref) and actual pricing.<br />
                    If total itinerary exceeds approved estimate by more than <strong>20%</strong>, the system flags the request for Administrative Review.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. FINANCE DASHBOARD */}
          {isFinance && summary?.finance && (
            <div className="portal-section">
              <div className="section-header">
                <h2>💳 Finance Disbursement &amp; Payment Operations</h2>
                <p>Verify manager-approved expense claims, bundle payment batches, and export bank payroll instructions.</p>
              </div>

              <div className="grid-3">
                <div className="card metric-card highlight-metric" style={{ borderLeft: '4px solid var(--success)' }}>
                  <div className="metric-icon success-icon">💰</div>
                  <div className="metric-data">
                    <div className="stat-num text-success">{summary.finance.readyCount}</div>
                    <div className="stat-label">Claims Ready for Batching</div>
                    <Link to="/finance" className="metric-link text-success font-bold">
                      Process Disbursement Batches &rarr;
                    </Link>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon" style={{ background: '#ecfdf5', color: '#047857' }}>📊</div>
                  <div className="metric-data">
                    <div className="stat-num">₹{summary.finance.pendingDisbursementInr}</div>
                    <div className="stat-label">Total Volume Pending Disbursement</div>
                    <span className="metric-sublabel">Awaiting bank CSV generation</span>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon warning-icon">🔍</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.finance.approvedPendingVerification}</div>
                    <div className="stat-label">Approved Pending Finance Verification</div>
                    <span className="metric-sublabel">Awaiting finance audit check</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. AUDITOR DASHBOARD */}
          {isAuditor && (
            <div className="portal-section">
              <div className="section-header">
                <h2>🛡️ Compliance &amp; Internal Audit Oversight</h2>
                <p>Complete read-only access to tamper-proof audit trails and financial reimbursement reports.</p>
              </div>

              <div className="grid-2">
                <div className="card metric-card" style={{ borderLeft: '4px solid #0284c7' }}>
                  <div className="metric-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>🔒</div>
                  <div className="metric-data">
                    <div className="stat-num" style={{ color: '#0284c7' }}>Database Triggers Active</div>
                    <div className="stat-label">Immutable Audit Log Architecture (FR-AUDIT-03)</div>
                    <Link to="/audit" className="metric-link" style={{ color: '#0284c7' }}>
                      Inspect Immutable Audit Log Trail &rarr;
                    </Link>
                  </div>
                </div>

                <div className="card metric-card" style={{ borderLeft: '4px solid #0284c7' }}>
                  <div className="metric-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>📋</div>
                  <div className="metric-data">
                    <div className="stat-num" style={{ color: '#0284c7' }}>Compliance Analytics</div>
                    <div className="stat-label">Policy Violations &amp; Overrun Reports</div>
                    <Link to="/reports" className="metric-link" style={{ color: '#0284c7' }}>
                      Open Compliance Analytics Reports &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. ADMIN DASHBOARD */}
          {isAdmin && summary?.admin && (
            <div className="portal-section">
              <div className="section-header">
                <h2>⚙️ System Administration Operations Console</h2>
                <p>Manage Employee Master records, RBAC permissions, policy rule versions, and global parameters.</p>
              </div>

              <div className="grid-4">
                <div className="card metric-card">
                  <div className="metric-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>👥</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.admin.activeUsersCount}</div>
                    <div className="stat-label">Active Users</div>
                    <Link to="/admin" className="metric-link">Manage Users &rarr;</Link>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>✈️</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.admin.openTravelRequests}</div>
                    <div className="stat-label">Open Travel Requests</div>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>💰</div>
                  <div className="metric-data">
                    <div className="stat-num">{summary.admin.monthlyReimbursementsCount}</div>
                    <div className="stat-label">Disbursements This Month</div>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>📈</div>
                  <div className="metric-data">
                    <div className="stat-num">₹{summary.admin.monthlyReimbursedInr}</div>
                    <div className="stat-label">Volume Disbursed</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
