import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = () => {
    apiRequest<any[]>('/notifications')
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'PUT' });
      fetchNotifs();
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">In-App Notifications</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Status updates and pending review alerts (FR-NOTIF-02..03)
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={handleMarkAllRead}>
            ✓ Mark All as Read ({unreadCount})
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div>Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No notifications yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '0.85rem 1.15rem',
                  borderRadius: '6px',
                  border: n.read ? '1px solid var(--border)' : '1px solid #bfdbfe',
                  background: n.read ? '#ffffff' : '#f0f9ff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background 0.2s ease'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: n.read ? '#334155' : 'var(--primary)' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>

                {!n.read && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
                    onClick={() => handleMarkRead(n.id)}
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
