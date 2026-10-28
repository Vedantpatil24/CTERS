import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<'employees' | 'users' | 'approvals' | 'policies' | 'settings'>('employees');

  // Employee Master State
  const [employees, setEmployees] = useState<any[]>([]);
  const [empForm, setEmpForm] = useState({
    employeeId: '',
    officialEmail: '',
    name: '',
    department: 'Engineering',
    designation: 'Software Engineer',
    reportsToEmployeeId: '',
    bankAccountRef: '',
    employmentStatus: 'active' as 'active' | 'terminated' | 'on_leave'
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['EMPLOYEE']);
  
  // Role Edit & Manager Reassign Modals / Actions
  const [editingRolesUser, setEditingRolesUser] = useState<any | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  
  const [reassignManagerUser, setReassignManagerUser] = useState<any | null>(null);
  const [newManagerEmpId, setNewManagerEmpId] = useState('');

  // Pending Approval Reassignment State
  const [approvalReassignForm, setApprovalReassignForm] = useState({
    approvalId: '',
    newApproverId: ''
  });

  // Policy Rules State
  const [policies, setPolicies] = useState<any[]>([]);
  const [policyForm, setPolicyForm] = useState({
    category: 'Meals',
    limitAmountInr: '3000',
    receiptThresholdInr: '1000',
    noticePeriodDays: '5'
  });

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});

  const [escalationResult, setEscalationResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ALL_ROLES = ['EMPLOYEE', 'APPROVING_MANAGER', 'TRAVEL_DESK', 'FINANCE', 'ADMIN', 'AUDITOR'];

  const fetchEmployees = () => apiRequest<any[]>('/admin/employees').then(setEmployees);
  const fetchUsers = () => apiRequest<any[]>('/admin/users').then(setUsers);
  const fetchPolicies = () => apiRequest<any[]>('/admin/policies').then(setPolicies);
  const fetchSettings = () => apiRequest<Record<string, string>>('/admin/settings').then(setSettings);

  useEffect(() => {
    fetchEmployees();
    fetchUsers();
    fetchPolicies();
    fetchSettings();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiRequest('/admin/employees', { method: 'POST', body: JSON.stringify(empForm) });
      setMessage('Employee record added to master database.');
      fetchEmployees();
      setEmpForm({
        employeeId: '',
        officialEmail: '',
        name: '',
        department: 'Engineering',
        designation: 'Software Engineer',
        reportsToEmployeeId: '',
        bankAccountRef: '',
        employmentStatus: 'active'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create employee');
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await apiRequest<any>('/admin/employees/import-csv', { method: 'POST', body: formData });
      setMessage(`Bulk import completed: ${res.imported} imported, ${res.skipped} skipped.`);
      setCsvFile(null);
      fetchEmployees();
    } catch (err: any) {
      setError(err.message || 'CSV import failed');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ employeeId: newUserId, roles: newUserRoles })
      });
      setMessage('User account created from employee master.');
      fetchUsers();
      setNewUserId('');
      setNewUserRoles(['EMPLOYEE']);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleSaveRoles = async (userId: string) => {
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/admin/users/${userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: selectedRoles })
      });
      setMessage('User roles successfully updated.');
      setEditingRolesUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update roles');
    }
  };

  const handleSaveReassignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignManagerUser || !newManagerEmpId) return;
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/admin/users/${reassignManagerUser.id}/reassign-manager`, {
        method: 'POST',
        body: JSON.stringify({ newManagerEmployeeId: newManagerEmpId })
      });
      setMessage(`Manager reassigned to ${newManagerEmpId}. Pending approvals routed.`);
      setReassignManagerUser(null);
      setNewManagerEmpId('');
      fetchUsers();
      fetchEmployees();
    } catch (err: any) {
      setError(err.message || 'Failed to reassign manager');
    }
  };

  const handleReassignApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiRequest('/admin/approvals/reassign', {
        method: 'POST',
        body: JSON.stringify(approvalReassignForm)
      });
      setMessage('Approval successfully reassigned to new approver.');
      setApprovalReassignForm({ approvalId: '', newApproverId: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to reassign approval');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!window.confirm('Deactivate this user account? Historical data will be preserved.')) return;
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/admin/users/${userId}/deactivate`, { method: 'POST' });
      setMessage('User account deactivated.');
      fetchUsers();
      fetchEmployees();
    } catch (err: any) {
      setError(err.message || 'Cannot deactivate user');
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiRequest('/admin/policies', {
        method: 'POST',
        body: JSON.stringify({
          category: policyForm.category,
          limitAmountPaise: Math.round(parseFloat(policyForm.limitAmountInr) * 100),
          receiptThresholdPaise: Math.round(parseFloat(policyForm.receiptThresholdInr) * 100),
          noticePeriodDays: parseInt(policyForm.noticePeriodDays)
        })
      });
      setMessage('New policy rule version deployed.');
      fetchPolicies();
    } catch (err: any) {
      setError(err.message || 'Failed to deploy policy');
    }
  };

  const handleDeactivatePolicy = async (id: string) => {
    if (!window.confirm('Deactivate this policy rule?')) return;
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/admin/policies/${id}/deactivate`, { method: 'PUT' });
      setMessage('Policy rule deactivated.');
      fetchPolicies();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate policy');
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      setMessage('System configuration parameters saved.');
      fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    }
  };

  const handleRunEscalation = async () => {
    setError(null);
    setEscalationResult(null);
    setLoading(true);
    try {
      const res = await apiRequest<any>('/admin/run-escalation', { method: 'POST' });
      setEscalationResult(res);
    } catch (err: any) {
      setError(err.message || 'Escalation job failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleNewUserRole = (r: string) => {
    if (newUserRoles.includes(r)) {
      if (newUserRoles.length > 1) {
        setNewUserRoles(newUserRoles.filter(role => role !== r));
      }
    } else {
      setNewUserRoles([...newUserRoles, r]);
    }
  };

  const toggleEditUserRole = (r: string) => {
    if (selectedRoles.includes(r)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter(role => role !== r));
      }
    } else {
      setSelectedRoles([...selectedRoles, r]);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Administration</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            HR Employee Master, user accounts, workflow reassignments, policy versioning, and system parameters (FR-ADMIN-01..05)
          </p>
        </div>
        <button
          className="btn btn-warning"
          onClick={handleRunEscalation}
          disabled={loading}
        >
          {loading ? 'Running...' : '⚡ Run Escalation Job (SLA > 3 Days)'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {escalationResult && (
        <div className="alert alert-warning">
          <strong>Escalation Execution Summary:</strong> {escalationResult.escalatedCount} pending approvals escalated to manager's supervisor.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'employees' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('employees')}>
          Employee Master (HR)
        </button>
        <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('users')}>
          User Accounts &amp; Roles
        </button>
        <button className={`btn ${tab === 'approvals' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('approvals')}>
          Approval Reassignment
        </button>
        <button className={`btn ${tab === 'policies' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('policies')}>
          Versioned Policy Rules
        </button>
        <button className={`btn ${tab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('settings')}>
          System Configuration
        </button>
      </div>

      {/* TAB 1: EMPLOYEES */}
      {tab === 'employees' && (
        <div>
          <div className="grid-2">
            <div className="card">
              <h3>Add Employee Master Record</h3>
              <form onSubmit={handleCreateEmployee} style={{ marginTop: '1rem' }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Employee ID</label>
                    <input type="text" className="form-control" value={empForm.employeeId} onChange={e => setEmpForm({...empForm, employeeId: e.target.value})} required placeholder="e.g. EMP099" />
                  </div>
                  <div className="form-group">
                    <label>Official Email</label>
                    <input type="email" className="form-control" value={empForm.officialEmail} onChange={e => setEmpForm({...empForm, officialEmail: e.target.value})} required placeholder="e.g. user@cters.corp" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" className="form-control" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Department</label>
                    <input type="text" className="form-control" value={empForm.department} onChange={e => setEmpForm({...empForm, department: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <input type="text" className="form-control" value={empForm.designation} onChange={e => setEmpForm({...empForm, designation: e.target.value})} required />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Reports To Employee ID</label>
                    <input type="text" className="form-control" value={empForm.reportsToEmployeeId} onChange={e => setEmpForm({...empForm, reportsToEmployeeId: e.target.value})} placeholder="e.g. EMP001" />
                  </div>
                  <div className="form-group">
                    <label>Bank Account Ref</label>
                    <input type="text" className="form-control" value={empForm.bankAccountRef} onChange={e => setEmpForm({...empForm, bankAccountRef: e.target.value})} placeholder="e.g. HDFC000123" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Employment Status</label>
                  <select
                    className="form-control"
                    value={empForm.employmentStatus}
                    onChange={e => setEmpForm({...empForm, employmentStatus: e.target.value as any})}
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">Add Employee</button>
              </form>
            </div>

            <div className="card">
              <h3>Bulk Import Employees via CSV</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Required columns: <code>employeeId, officialEmail, name, department, designation</code>
              </p>
              <form onSubmit={handleImportCsv}>
                <div className="form-group">
                  <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} required />
                </div>
                <button type="submit" className="btn btn-secondary">Upload &amp; Import CSV</button>
              </form>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3>Employee Master Database ({employees.length} Records)</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Official Email</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Reports To</th>
                  <th>Status</th>
                  <th>User Linked</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id}>
                    <td><strong>{e.employeeId}</strong></td>
                    <td>{e.name}</td>
                    <td>{e.officialEmail}</td>
                    <td>{e.department}</td>
                    <td>{e.designation}</td>
                    <td>{e.reportsToEmployeeId || '—'}</td>
                    <td>
                      <span className={`badge ${e.employmentStatus === 'active' ? 'badge-approved' : 'badge-rejected'}`}>
                        {e.employmentStatus}
                      </span>
                    </td>
                    <td>{e.user ? (e.user.activated ? 'Activated' : 'Pending OTP') : 'No Account'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {tab === 'users' && (
        <div>
          <div className="card">
            <h3>Create User Account from Master (BR-1)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Per Business Rule 1: Nobody can get an account unless they already exist in the HR Employee Master.
            </p>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0, minWidth: '220px' }}>
                  <label>Employee ID from Master</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newUserId}
                    onChange={e => setNewUserId(e.target.value)}
                    placeholder="e.g. EMP008"
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <label>Assign Roles (Select Multi-Roles)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    {ALL_ROLES.map(r => (
                      <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                          type="checkbox"
                          checked={newUserRoles.includes(r)}
                          onChange={() => toggleNewUserRole(r)}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ alignSelf: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary">Create User Account</button>
                </div>
              </div>
            </form>
          </div>

          {/* Edit Roles Modal */}
          {editingRolesUser && (
            <div className="card" style={{ marginTop: '1rem', border: '2px solid var(--primary-color)' }}>
              <h4>Edit Roles for {editingRolesUser.employeeMaster?.name} ({editingRolesUser.employeeMaster?.employeeId})</h4>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1rem 0' }}>
                {ALL_ROLES.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r)}
                      onChange={() => toggleEditUserRole(r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-success" onClick={() => handleSaveRoles(editingRolesUser.id)}>
                  Save Roles
                </button>
                <button className="btn btn-secondary" onClick={() => setEditingRolesUser(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reassign Manager Modal */}
          {reassignManagerUser && (
            <div className="card" style={{ marginTop: '1rem', border: '2px solid var(--accent-color)' }}>
              <h4>Reassign Reporting Manager for {reassignManagerUser.employeeMaster?.name} ({reassignManagerUser.employeeMaster?.employeeId})</h4>
              <form onSubmit={handleSaveReassignManager} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginTop: '0.5rem' }}>
                <div className="form-group" style={{ margin: 0, minWidth: '250px' }}>
                  <label>New Manager Employee ID</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newManagerEmpId}
                    onChange={e => setNewManagerEmpId(e.target.value)}
                    placeholder="e.g. EMP002"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary">Reassign &amp; Re-route</button>
                <button type="button" className="btn btn-secondary" onClick={() => setReassignManagerUser(null)}>Cancel</button>
              </form>
            </div>
          )}

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3>Registered User Accounts ({users.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Assigned Roles</th>
                  <th>Status</th>
                  <th>Failed Logins</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.employeeMaster?.employeeId}</strong></td>
                    <td>{u.employeeMaster?.name}</td>
                    <td>{u.employeeMaster?.officialEmail}</td>
                    <td>
                      {u.roles?.map((r: any) => (
                        <span key={r.role} className="badge badge-secondary" style={{ marginRight: '0.25rem' }}>
                          {r.role}
                        </span>
                      ))}
                    </td>
                    <td>
                      {u.activated ? <span className="badge badge-approved">Active</span> : <span className="badge badge-draft">Pending</span>}
                    </td>
                    <td>{u.failedLoginAttempts}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setEditingRolesUser(u);
                            setSelectedRoles(u.roles?.map((r: any) => r.role) || ['EMPLOYEE']);
                          }}
                        >
                          Roles
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setReassignManagerUser(u);
                            setNewManagerEmpId('');
                          }}
                        >
                          Reassign Mgr
                        </button>
                        {u.activated && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                            onClick={() => handleDeactivateUser(u.id)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: APPROVAL REASSIGNMENT */}
      {tab === 'approvals' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3>Reassign Pending Approval Task</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Allows an administrator to manually intervene and reassign any stalled pending approval record to another qualified manager.
          </p>
          <form onSubmit={handleReassignApproval}>
            <div className="form-group">
              <label>Approval Record ID (UUID)</label>
              <input
                type="text"
                className="form-control"
                value={approvalReassignForm.approvalId}
                onChange={e => setApprovalReassignForm({ ...approvalReassignForm, approvalId: e.target.value })}
                placeholder="e.g. 1a2b3c4d-..."
                required
              />
            </div>
            <div className="form-group">
              <label>New Approver User ID (UUID)</label>
              <input
                type="text"
                className="form-control"
                value={approvalReassignForm.newApproverId}
                onChange={e => setApprovalReassignForm({ ...approvalReassignForm, newApproverId: e.target.value })}
                placeholder="Target User UUID from Users tab"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Reassign Approval Record</button>
          </form>
        </div>
      )}

      {/* TAB 4: POLICIES */}
      {tab === 'policies' && (
        <div>
          <div className="card">
            <h3>Deploy New Policy Rule Version (FR-ADMIN-01..02)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Updates automatically increment the rule version. Historical submissions maintain their original version snapshot.
            </p>
            <form onSubmit={handleCreatePolicy} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Category</label>
                <select className="form-control" value={policyForm.category} onChange={e => setPolicyForm({...policyForm, category: e.target.value})}>
                  <option value="Flight">Flight</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Meals">Meals</option>
                  <option value="Local Transport">Local Transport</option>
                  <option value="Conference">Conference</option>
                  <option value="Misc">Misc</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Limit (₹)</label>
                <input type="number" className="form-control" value={policyForm.limitAmountInr} onChange={e => setPolicyForm({...policyForm, limitAmountInr: e.target.value})} required />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Receipt Threshold (₹)</label>
                <input type="number" className="form-control" value={policyForm.receiptThresholdInr} onChange={e => setPolicyForm({...policyForm, receiptThresholdInr: e.target.value})} required />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Notice Days</label>
                <input type="number" className="form-control" value={policyForm.noticePeriodDays} onChange={e => setPolicyForm({...policyForm, noticePeriodDays: e.target.value})} required />
              </div>

              <button type="submit" className="btn btn-primary">+ Deploy Rule</button>
            </form>
          </div>

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3>Policy Rules Catalog</h3>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Version</th>
                  <th>Spending Limit</th>
                  <th>Mandatory Receipt Threshold</th>
                  <th>Notice Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.category}</strong></td>
                    <td><code>v{p.version}</code></td>
                    <td>₹{(p.limitAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹{(p.receiptThresholdPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>{p.noticePeriodDays} days</td>
                    <td>
                      <span className={`badge ${p.active ? 'badge-approved' : 'badge-draft'}`}>
                        {p.active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td>
                      {p.active && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() => handleDeactivatePolicy(p.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {tab === 'settings' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3>Global System Settings (FR-ADMIN-03)</h3>
          <form onSubmit={handleUpdateSettings} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>Booking Cost Overrun Threshold (%)</label>
              <input
                type="number"
                className="form-control"
                value={settings.bookingOverrunPct || '20'}
                onChange={e => setSettings({...settings, bookingOverrunPct: e.target.value})}
              />
              <small style={{ color: 'var(--text-muted)' }}>Flags request for admin if actual cost &gt; estimate * (1 + overrun%)</small>
            </div>

            <div className="form-group">
              <label>Level 2 Travel Approval Threshold (Paise)</label>
              <input
                type="number"
                className="form-control"
                value={settings.secondLevelTravelPaise || '5000000'}
                onChange={e => setSettings({...settings, secondLevelTravelPaise: e.target.value})}
              />
              <small style={{ color: 'var(--text-muted)' }}>Default: 5000000 paise (₹50,000)</small>
            </div>

            <div className="form-group">
              <label>Level 2 Expense Claim Approval Threshold (Paise)</label>
              <input
                type="number"
                className="form-control"
                value={settings.secondLevelClaimPaise || '2500000'}
                onChange={e => setSettings({...settings, secondLevelClaimPaise: e.target.value})}
              />
              <small style={{ color: 'var(--text-muted)' }}>Default: 2500000 paise (₹25,000)</small>
            </div>

            <div className="form-group">
              <label>Failed Login Lockout Threshold (Attempts)</label>
              <input
                type="number"
                className="form-control"
                value={settings.lockoutThreshold || '5'}
                onChange={e => setSettings({...settings, lockoutThreshold: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Approval SLA Escalate Days</label>
              <input
                type="number"
                className="form-control"
                value={settings.slaDays || '3'}
                onChange={e => setSettings({...settings, slaDays: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Simulate Bank Export Failure (Testing Mode)</label>
              <select
                className="form-control"
                value={settings.simulateExportFailure || 'false'}
                onChange={e => setSettings({...settings, simulateExportFailure: e.target.value})}
              >
                <option value="false">false (Normal CSV Generation)</option>
                <option value="true">true (Simulate Bank Gateway Failure)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary">Save Settings</button>
          </form>
        </div>
      )}
    </div>
  );
};
