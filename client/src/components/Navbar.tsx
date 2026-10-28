import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';

export const Navbar: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      apiRequest<any[]>('/notifications')
        .then(notifs => {
          const unread = notifs.filter(n => !n.read).length;
          setUnreadCount(unread);
        })
        .catch(() => {});
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine Primary Role (excluding EMPLOYEE if they hold an officer role)
  const officerRole = user.roles.find(r => r !== 'EMPLOYEE');
  const displayRole = officerRole || 'EMPLOYEE';

  const isPureEmployee = user.roles.length === 1 && user.roles[0] === 'EMPLOYEE';
  const isManager = hasRole('APPROVING_MANAGER');
  const isTravelDesk = hasRole('TRAVEL_DESK');
  const isFinance = hasRole('FINANCE');
  const isAdmin = hasRole('ADMIN');
  const isAuditor = hasRole('AUDITOR');

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/" className="brand-logo">
          <span className="brand-icon">✈️</span>
          <span className="brand-text">CTERS</span>
          <span className="portal-subtext">{displayRole.replace('_', ' ')} PORTAL</span>
        </Link>
      </div>

      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`}>
          <span className="nav-icon">📊</span> Dashboard
        </Link>

        {/* 1. EMPLOYEE: Only pure employees see travel & claims creation tabs */}
        {isPureEmployee && (
          <>
            <Link to="/travel" className={`nav-link ${isActive('/travel')}`}>
              <span className="nav-icon">✈️</span> Travel Requests
            </Link>
            <Link to="/claims" className={`nav-link ${isActive('/claims')}`}>
              <span className="nav-icon">🧾</span> Expense Claims
            </Link>
          </>
        )}

        {/* 2. APPROVING MANAGER: Exclusively Approvals Queue & Reports */}
        {isManager && (
          <>
            <Link to="/approvals" className={`nav-link ${isActive('/approvals')}`}>
              <span className="nav-icon">📋</span> Approvals Queue
            </Link>
            <Link to="/reports" className={`nav-link ${isActive('/reports')}`}>
              <span className="nav-icon">📈</span> Reports
            </Link>
          </>
        )}

        {/* 3. TRAVEL DESK: Exclusively Booking Queue */}
        {isTravelDesk && (
          <Link to="/bookings" className={`nav-link ${isActive('/bookings')}`}>
            <span className="nav-icon">🎫</span> Booking Queue
          </Link>
        )}

        {/* 4. FINANCE: Exclusively Finance Processing & Reports */}
        {isFinance && (
          <>
            <Link to="/finance" className={`nav-link ${isActive('/finance')}`}>
              <span className="nav-icon">💳</span> Finance &amp; Batches
            </Link>
            <Link to="/reports" className={`nav-link ${isActive('/reports')}`}>
              <span className="nav-icon">📈</span> Reports
            </Link>
          </>
        )}

        {/* 5. AUDITOR: Exclusively Audit Trail & Compliance Reports */}
        {isAuditor && !isAdmin && (
          <>
            <Link to="/audit" className={`nav-link ${isActive('/audit')}`}>
              <span className="nav-icon">🛡️</span> Audit Logs
            </Link>
            <Link to="/reports" className={`nav-link ${isActive('/reports')}`}>
              <span className="nav-icon">📈</span> Compliance Reports
            </Link>
          </>
        )}

        {/* 6. ADMIN: Admin Console & Audit */}
        {isAdmin && (
          <>
            <Link to="/admin" className={`nav-link ${isActive('/admin')}`}>
              <span className="nav-icon">⚙️</span> Admin Console
            </Link>
            <Link to="/audit" className={`nav-link ${isActive('/audit')}`}>
              <span className="nav-icon">🛡️</span> Audit Logs
            </Link>
            <Link to="/reports" className={`nav-link ${isActive('/reports')}`}>
              <span className="nav-icon">📈</span> Reports
            </Link>
          </>
        )}

        {/* Shared Utility Links */}
        <Link to="/notifications" className={`nav-link ${isActive('/notifications')}`} style={{ position: 'relative' }}>
          <span className="nav-icon">🔔</span> Alerts
          {unreadCount > 0 && (
            <span className="notification-pill">
              {unreadCount}
            </span>
          )}
        </Link>
        <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
          <span className="nav-icon">👤</span> Profile
        </Link>
      </div>

      <div className="user-badge">
        <div className="user-info-text">
          <span className="user-name">{user.name}</span>
          <span className="user-emp-id">{user.employeeId}</span>
        </div>
        <span className={`role-pill role-pill-${displayRole.toLowerCase()}`}>
          {displayRole.replace('_', ' ')}
        </span>
        <button onClick={handleLogout} className="btn-logout" title="Sign out of CTERS">
          Logout
        </button>
      </div>
    </nav>
  );
};
