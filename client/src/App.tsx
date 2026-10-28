import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { ActivatePage } from './pages/ActivatePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { TravelListPage } from './pages/TravelListPage';
import { TravelDetailPage } from './pages/TravelDetailPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { BookingQueuePage } from './pages/BookingQueuePage';
import { ClaimsListPage } from './pages/ClaimsListPage';
import { ClaimDetailPage } from './pages/ClaimDetailPage';
import { FinancePage } from './pages/FinancePage';
import { AdminPage } from './pages/AdminPage';
import { AuditPage } from './pages/AuditPage';
import { OutboxPage } from './pages/OutboxPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReportsPage } from './pages/ReportsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Authenticating CTERS session...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return (
      <div className="container" style={{ marginTop: '3rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>403 — Unauthorized Access</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Your account ({user.roles.join(', ')}) does not have permission to access this module.
          </p>
          <a href="/" className="btn btn-primary">Return to My Dashboard</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/outbox" element={<OutboxPage />} />

          {/* Protected routes with Role-Based Access Control */}
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

          {/* 1. Employee exclusive travel & claims */}
          <Route path="/travel" element={
            <ProtectedRoute allowedRoles={['EMPLOYEE']}>
              <TravelListPage />
            </ProtectedRoute>
          } />
          <Route path="/travel/:id" element={
            <ProtectedRoute allowedRoles={['EMPLOYEE', 'APPROVING_MANAGER', 'TRAVEL_DESK', 'ADMIN']}>
              <TravelDetailPage />
            </ProtectedRoute>
          } />

          <Route path="/claims" element={
            <ProtectedRoute allowedRoles={['EMPLOYEE']}>
              <ClaimsListPage />
            </ProtectedRoute>
          } />
          <Route path="/claims/:id" element={
            <ProtectedRoute allowedRoles={['EMPLOYEE', 'APPROVING_MANAGER', 'FINANCE', 'AUDITOR', 'ADMIN']}>
              <ClaimDetailPage />
            </ProtectedRoute>
          } />

          {/* 2. Approving Manager */}
          <Route path="/approvals" element={
            <ProtectedRoute allowedRoles={['APPROVING_MANAGER', 'ADMIN']}>
              <ApprovalsPage />
            </ProtectedRoute>
          } />

          {/* 3. Travel Desk */}
          <Route path="/bookings" element={
            <ProtectedRoute allowedRoles={['TRAVEL_DESK', 'ADMIN']}>
              <BookingQueuePage />
            </ProtectedRoute>
          } />

          {/* 4. Finance */}
          <Route path="/finance" element={
            <ProtectedRoute allowedRoles={['FINANCE', 'ADMIN']}>
              <FinancePage />
            </ProtectedRoute>
          } />

          {/* 5. Reports */}
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={['APPROVING_MANAGER', 'FINANCE', 'AUDITOR', 'ADMIN']}>
              <ReportsPage />
            </ProtectedRoute>
          } />

          {/* 6. Admin */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminPage />
            </ProtectedRoute>
          } />

          {/* 7. Auditor */}
          <Route path="/audit" element={
            <ProtectedRoute allowedRoles={['AUDITOR', 'ADMIN']}>
              <AuditPage />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
