import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  HardDrive, 
  Search, 
  Loader2, 
  Edit3, 
  UserCheck, 
  Check, 
  X,
  AlertCircle,
  Key,
  Copy,
  Clock,
  Plus,
  Trash2,
  UserX
} from 'lucide-react';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  banned?: boolean;
  banReason?: string | null;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  storageQuotaFormatted: string;
  storageUsedFormatted: string;
  twoFactorEnabled: boolean;
  filesCount?: number;
  foldersCount?: number;
  createdAt: string;
}

export interface InviteCodeItem {
  id: string;
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  creatorName: string;
  usedByName?: string | null;
  usedByEmail?: string | null;
  usedAt?: string | null;
  expiresAt: string;
  createdAt: string;
}

export const AdminUserManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'invites' | 'resets'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeItem[]>([]);
  const [passwordResets, setPasswordResets] = useState<any[]>([]);
  const [adminResetPasswordVal, setAdminResetPasswordVal] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  // Detailed User Inspector Modal State
  const [inspectingUser, setInspectingUser] = useState<AdminUser | null>(null);
  const [banReasonText, setBanReasonText] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [newQuotaGb, setNewQuotaGb] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Direct User Creation Modal State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user');
  const [createQuotaGb, setCreateQuotaGb] = useState<number>(100);
  const [creatingUser, setCreatingUser] = useState(false);

  // OTP Generator State
  const [expiresInMinutes, setExpiresInMinutes] = useState<number>(60);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<InviteCodeItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch user list');
      }
    } catch (err: any) {
      console.error('Error fetching admin users:', err);
      setError(err.message || 'Error connecting to admin server');
    } finally {
      setLoading(false);
    }
  };

  const fetchInviteCodes = async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch('/api/admin/invite-codes', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setInviteCodes(data.inviteCodes || []);
      }
    } catch (err: any) {
      console.error('Error fetching invite codes:', err);
    } finally {
      setLoadingCodes(false);
    }
  };

  const fetchPasswordResets = async () => {
    try {
      const res = await fetch('/api/admin/password-resets', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPasswordResets(data.resets || []);
      }
    } catch (err) {
      console.error('Error fetching simulated password resets:', err);
    }
  };

  const handleClearResets = async () => {
    if (!window.confirm('Are you sure you want to clear all simulated password reset links?')) return;
    try {
      const res = await fetch('/api/admin/password-resets/clear', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setPasswordResets([]);
        setSuccessMsg('Simulated password resets cleared.');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error clearing resets:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchInviteCodes();
    fetchPasswordResets();
  }, []);

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/admin/invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInMinutes }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Generated 1-time OTP Code: ${data.inviteCode.code}`);
        setGeneratedCode(data.inviteCode);
        fetchInviteCodes();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        alert(data.error || 'Failed to generate invite code');
      }
    } catch (err: any) {
      alert(err.message || 'Error generating invite code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleRevokeCode = async (codeId: string) => {
    if (!confirm('Revoke this invite code?')) return;
    try {
      const res = await fetch(`/api/admin/invite-code/${codeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setInviteCodes(inviteCodes.filter((c) => c.id !== codeId));
        setSuccessMsg('Invite code revoked');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert('Failed to revoke code');
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleRoleToggle = async (user: AdminUser) => {
    const targetRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change ${user.name}'s role to ${targetRole.toUpperCase()}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/user/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
        credentials: 'include',
      });

      if (res.ok) {
        setUsers(users.map((u) => (u.id === user.id ? { ...u, role: targetRole } : u)));
        if (inspectingUser?.id === user.id) {
          setInspectingUser({ ...inspectingUser, role: targetRole });
        }
        setSuccessMsg(`Role updated to ${targetRole.toUpperCase()} for ${user.name}`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update role');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating user role');
    }
  };

  const handleSuspendToggle = async (user: AdminUser, banned: boolean, reason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned, banReason: reason || 'Suspended by administrator' }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map((u) => (u.id === user.id ? { ...u, banned, banReason: reason || null } : u)));
        if (inspectingUser?.id === user.id) {
          setInspectingUser({ ...inspectingUser, banned, banReason: reason || null });
        }
        setSuccessMsg(data.message || 'User status updated');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${user.name} (${user.email})? This action cannot be undone and will delete all their files.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== user.id));
        if (inspectingUser?.id === user.id) {
          setInspectingUser(null);
        }
        setSuccessMsg(data.message || 'User deleted');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName || !createEmail || !createPassword) {
      alert('Please fill out all required fields');
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
          role: createRole,
          storageQuotaGb: createQuotaGb,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'User created successfully');
        setShowCreateUserModal(false);
        setCreateName('');
        setCreateEmail('');
        setCreatePassword('');
        fetchUsers();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating user');
    } finally {
      setCreatingUser(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const totalUsedBytes = users.reduce((acc, u) => acc + (u.storageUsedBytes || 0), 0);
  const totalUsedGb = (totalUsedBytes / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <div
      className="content-surface"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px 24px',
        overflowY: 'auto',
      }}
    >
      {/* Page Header & Stats Summary */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
          User Management & Storage Admin
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#72777A' }}>
          Manage user accounts, assign admin permissions, and allocate custom storage quotas
        </p>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '16px',
          }}
        >
          <div style={statCardStyle}>
            <div style={{ background: '#E8F0FE', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Users size={20} color="#0B57D0" />
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F1F1F' }}>{totalUsers}</div>
              <div style={{ fontSize: '0.78rem', color: '#5F6368' }}>Registered Users</div>
            </div>
          </div>

          <div style={statCardStyle}>
            <div style={{ background: '#FEF7E0', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <UserCheck size={20} color="#B06000" />
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F1F1F' }}>{adminCount}</div>
              <div style={{ fontSize: '0.78rem', color: '#5F6368' }}>System Administrators</div>
            </div>
          </div>

          <div style={statCardStyle}>
            <div style={{ background: '#E6F4EA', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <HardDrive size={20} color="#137333" />
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F1F1F' }}>{totalUsedGb} GB</div>
              <div style={{ fontSize: '0.78rem', color: '#5F6368' }}>Total Cloud Usage</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E0E3E7', paddingBottom: '12px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveSubTab('users')}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === 'users' ? '#0B57D0' : '#F1F3F4',
              color: activeSubTab === 'users' ? '#FFFFFF' : '#3C4043',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={16} />
            <span>User Directory ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('invites')}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === 'invites' ? '#0B57D0' : '#F1F3F4',
              color: activeSubTab === 'invites' ? '#FFFFFF' : '#3C4043',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Key size={16} />
            <span>One-Time Invite Passcodes (OTP) ({inviteCodes.filter(c => c.status === 'ACTIVE').length} Active)</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('resets');
              fetchPasswordResets();
            }}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === 'resets' ? '#0B57D0' : '#F1F3F4',
              color: activeSubTab === 'resets' ? '#FFFFFF' : '#3C4043',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Clock size={16} />
            <span>Simulated Password Resets ({passwordResets.length})</span>
          </button>
        </div>

      {successMsg && (
        <div
          style={{
            background: '#E6F4EA',
            color: '#137333',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '0.86rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#FCE8E6',
            color: '#C5221F',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '0.86rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: USER DIRECTORY VIEW */}
      {/* ========================================================================= */}
      {activeSubTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="#5F6368" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search user by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '20px',
                  border: '1px solid #E0E3E7',
                  fontSize: '0.86rem',
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setRoleFilter('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontSize: '0.78rem',
                    fontWeight: roleFilter === 'all' ? 700 : 500,
                    border: '1px solid #E0E3E7',
                    background: roleFilter === 'all' ? '#0B57D0' : '#FFFFFF',
                    color: roleFilter === 'all' ? '#FFFFFF' : '#3C4043',
                    cursor: 'pointer',
                  }}
                >
                  All Roles ({users.length})
                </button>
                <button
                  onClick={() => setRoleFilter('user')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontSize: '0.78rem',
                    fontWeight: roleFilter === 'user' ? 700 : 500,
                    border: '1px solid #E0E3E7',
                    background: roleFilter === 'user' ? '#0B57D0' : '#FFFFFF',
                    color: roleFilter === 'user' ? '#FFFFFF' : '#3C4043',
                    cursor: 'pointer',
                  }}
                >
                  Users ({users.filter((u) => u.role === 'user').length})
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontSize: '0.78rem',
                    fontWeight: roleFilter === 'admin' ? 700 : 500,
                    border: '1px solid #E0E3E7',
                    background: roleFilter === 'admin' ? '#0B57D0' : '#FFFFFF',
                    color: roleFilter === 'admin' ? '#FFFFFF' : '#3C4043',
                    cursor: 'pointer',
                  }}
                >
                  Admins ({users.filter((u) => u.role === 'admin').length})
                </button>
              </div>

              <button
                onClick={() => setShowCreateUserModal(true)}
                className="btn btn-primary"
                style={{ padding: '7px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                <span>Add New User</span>
              </button>
            </div>
          </div>

          {/* Users Data Table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '3rem' }}>
              <Loader2 size={36} className="spin" color="#0B57D0" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#5F6368' }}>
              No users found matching your search.
            </div>
          ) : (
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E0E3E7',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFD', borderBottom: '1px solid #E0E3E7', color: '#5F6368', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 16px' }}>User Details</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Role</th>
                    <th style={{ padding: '12px 16px' }}>Storage Usage / Quota</th>
                    <th style={{ padding: '12px 16px' }}>Items</th>
                    <th style={{ padding: '12px 16px' }}>Joined Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const used = user.storageUsedBytes || 0;
                    const quota = user.storageQuotaBytes || 107374182400;
                    const percent = Math.min(100, Math.round((used / quota) * 100));
                    const initials = user.name
                      ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
                      : 'U';

                    return (
                      <tr
                        key={user.id}
                        style={{
                          borderBottom: '1px solid #F1F3F4',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4F9')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: user.banned ? '#EA4335' : '#0B57D0',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#1F1F1F' }}>{user.name}</div>
                              <div style={{ fontSize: '0.78rem', color: '#5F6368' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: user.banned ? '#FCE8E6' : '#E6F4EA',
                              color: user.banned ? '#C5221F' : '#137333',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {user.banned ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                            <span>{user.banned ? 'SUSPENDED' : 'ACTIVE'}</span>
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => handleRoleToggle(user)}
                            title={`Click to switch role to ${user.role === 'admin' ? 'USER' : 'ADMIN'}`}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              background: user.role === 'admin' ? '#FEF7E0' : '#E8F0FE',
                              color: user.role === 'admin' ? '#B06000' : '#0B57D0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            {user.role === 'admin' ? <UserCheck size={12} /> : <Users size={12} />}
                            <span>{user.role.toUpperCase()}</span>
                          </button>
                        </td>

                        <td style={{ padding: '12px 16px', width: '200px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#3C4043' }}>
                              <span>{user.storageUsedFormatted}</span>
                              <span style={{ color: '#5F6368' }}>{user.storageQuotaFormatted}</span>
                            </div>

                            <div style={{ height: '6px', borderRadius: '3px', background: '#E0E3E7', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${percent}%`,
                                  background: percent > 90 ? '#EA4335' : percent > 75 ? '#FBBC04' : '#1A73E8',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#5F6368' }}>
                          {user.filesCount || 0} files / {user.foldersCount || 0} folders
                        </td>

                        <td style={{ padding: '12px 16px', color: '#5F6368', fontSize: '0.8rem' }}>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setInspectingUser(user);
                                setBanReasonText(user.banReason || '');
                                setNewQuotaGb(Math.round((user.storageQuotaBytes || 107374182400) / (1024 * 1024 * 1024)));
                              }}
                              className="btn btn-primary"
                              style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit3 size={13} />
                              <span>Manage</span>
                            </button>

                            <button
                              onClick={() => handleSuspendToggle(user, !user.banned)}
                              title={user.banned ? 'Unsuspend User Account' : 'Suspend User Account'}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '8px',
                                border: '1px solid #E0E3E7',
                                background: user.banned ? '#E6F4EA' : '#FEF7E0',
                                color: user.banned ? '#137333' : '#B06000',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              {user.banned ? <UserCheck size={14} /> : <UserX size={14} />}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user)}
                              title="Delete User Account"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '8px',
                                border: '1px solid #FCE8E6',
                                background: '#FCE8E6',
                                color: '#C5221F',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ONE-TIME INVITE CODES (OTP) VIEW */}
      {activeSubTab === 'invites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* OTP Code Generator Box */}
          <div
            style={{
              background: '#F8FAFD',
              border: '1px solid #D3E3FD',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#041E49', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#0B57D0" />
                Generate Single-Use Registration OTP Code
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#5F6368' }}>
                Each passcode can be used <strong>only 1 time</strong> to register an account and will automatically expire after your selected duration.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#3C4043', marginBottom: '6px' }}>
                  Expiration Time
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: '1 Min', val: 1 },
                    { label: '5 Mins', val: 5 },
                    { label: '15 Mins', val: 15 },
                    { label: '1 Hour', val: 60 },
                    { label: '24 Hours (Max)', val: 1440 },
                  ].map((dur) => (
                    <button
                      key={dur.val}
                      type="button"
                      onClick={() => setExpiresInMinutes(dur.val)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: expiresInMinutes === dur.val ? '1px solid #0B57D0' : '1px solid #E0E3E7',
                        background: expiresInMinutes === dur.val ? '#E8F0FE' : '#FFFFFF',
                        color: expiresInMinutes === dur.val ? '#0B57D0' : '#3C4043',
                        cursor: 'pointer',
                      }}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="btn btn-primary"
                style={{ marginTop: '20px', padding: '9px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {generatingCode ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                <span>Generate Passcode</span>
              </button>
            </div>

            {/* Generated Code Display Box */}
            {generatedCode && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '2px dashed #0B57D0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  marginTop: '4px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Generated Passcode (6-Digit OTP)
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0B57D0', letterSpacing: '0.15em', fontFamily: 'monospace' }}>
                    {generatedCode.code}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#B06000', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Clock size={12} />
                    <span>Expires at: {new Date(generatedCode.expiresAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => copyToClipboard(generatedCode.code, 'code')}
                    className="btn btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {copiedField === 'code' ? <Check size={14} color="#137333" /> : <Copy size={14} />}
                    <span>{copiedField === 'code' ? 'Copied Code!' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/register?code=${generatedCode.code}`, 'link')}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {copiedField === 'link' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedField === 'link' ? 'Copied Link!' : 'Copy Register Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Invite Codes Data Table */}
          {loadingCodes ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 size={32} className="spin" color="#0B57D0" />
            </div>
          ) : inviteCodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#5F6368' }}>
              No invite codes generated yet. Click "Generate Passcode" above to create one.
            </div>
          ) : (
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E0E3E7',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFD', borderBottom: '1px solid #E0E3E7', color: '#5F6368', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 16px' }}>Passcode (OTP)</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Expires At</th>
                    <th style={{ padding: '12px 16px' }}>Used By</th>
                    <th style={{ padding: '12px 16px' }}>Created Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteCodes.map((item) => {
                    const isCopying = copiedField === item.id;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #F1F3F4' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: '#0B57D0' }}>
                          {item.code}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: item.status === 'ACTIVE' ? '#E6F4EA' : item.status === 'USED' ? '#E8F0FE' : '#FCE8E6',
                              color: item.status === 'ACTIVE' ? '#137333' : item.status === 'USED' ? '#0B57D0' : '#C5221F',
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#5F6368' }}>
                          {new Date(item.expiresAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>
                          {item.usedByName ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#1F1F1F' }}>{item.usedByName}</div>
                              <div style={{ fontSize: '0.74rem', color: '#5F6368' }}>{item.usedByEmail}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#9AA0A6' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#5F6368' }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            {item.status === 'ACTIVE' && (
                              <button
                                onClick={() => copyToClipboard(`${window.location.origin}/register?code=${item.code}`, item.id)}
                                title="Copy Register Link"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#0B57D0' }}
                              >
                                {isCopying ? <Check size={16} color="#137333" /> : <Copy size={16} />}
                              </button>
                            )}

                            {item.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleRevokeCode(item.id)}
                                title="Revoke Code"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#EA4335' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}

      {activeSubTab === 'resets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#5F6368' }}>
              These are temporary local simulated password resets. The links contain secure reset tokens that can be shared with users to let them set new passwords.
            </div>
            {passwordResets.length > 0 && (
              <button
                onClick={handleClearResets}
                className="btn btn-secondary"
                style={{ color: '#C5221F', background: '#FCE8E6', border: 'none', padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Clear Reset Links
              </button>
            )}
          </div>

          <div
            className="content-surface"
            style={{
              padding: '0px',
              overflowX: 'auto',
              background: '#FFFFFF',
              borderRadius: '16px',
            }}
          >
            {passwordResets.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#5F6368' }}>
                No simulated password resets are currently pending.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFD', borderBottom: '1px solid #E0E3E7', color: '#5F6368', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 16px' }}>User</th>
                    <th style={{ padding: '12px 16px' }}>Email</th>
                    <th style={{ padding: '12px 16px' }}>Requested Time</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {passwordResets.map((item, idx) => {
                    const isCopying = copiedField === `reset-${idx}`;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F3F4' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1F1F1F' }}>
                          {item.name}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#5F6368' }}>
                          {item.email}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#5F6368' }}>
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              try {
                                const url = new URL(item.url);
                                const localResetUrl = `${window.location.origin}${url.pathname}${url.search}`;
                                copyToClipboard(localResetUrl, `reset-${idx}`);
                              } catch (e) {
                                copyToClipboard(item.url, `reset-${idx}`);
                              }
                            }}
                            title="Copy Password Reset Link"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '6px 12px',
                              color: '#0B57D0',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isCopying ? <Check size={14} color="#137333" /> : <Copy size={14} />}
                            <span>{isCopying ? 'Copied Link' : 'Copy Reset Link'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED USER INSPECTOR & CONTROL MODAL */}
      {/* ========================================================================= */}
      {inspectingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.22)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: inspectingUser.banned ? '#EA4335' : '#0B57D0',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                  }}
                >
                  {inspectingUser.name ? inspectingUser.name.substring(0, 2).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1F1F1F' }}>
                    {inspectingUser.name}
                  </h3>
                  <div style={{ fontSize: '0.84rem', color: '#5F6368', marginTop: '2px' }}>
                    {inspectingUser.email}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectingUser(null)}
                style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* User Badges Summary */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: inspectingUser.banned ? '#FCE8E6' : '#E6F4EA',
                  color: inspectingUser.banned ? '#C5221F' : '#137333',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {inspectingUser.banned ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                <span>{inspectingUser.banned ? 'SUSPENDED' : 'ACTIVE ACCOUNT'}</span>
              </span>

              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: inspectingUser.role === 'admin' ? '#FEF7E0' : '#E8F0FE',
                  color: inspectingUser.role === 'admin' ? '#B06000' : '#0B57D0',
                }}
              >
                {inspectingUser.role.toUpperCase()}
              </span>

              <span style={{ fontSize: '0.78rem', color: '#5F6368', padding: '4px 8px' }}>
                Joined: {new Date(inspectingUser.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Quick Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                background: '#F8FAFD',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: '#5F6368', fontWeight: 600 }}>Storage Used</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1F1F1F' }}>{inspectingUser.storageUsedFormatted}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#5F6368', fontWeight: 600 }}>Total Quota</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0B57D0' }}>{inspectingUser.storageQuotaFormatted}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#5F6368', fontWeight: 600 }}>Items Stored</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1F1F1F' }}>{inspectingUser.filesCount || 0} Files</div>
              </div>
            </div>

            {/* CONTROL SECTION 1: Account Status (Suspend / Unsuspend) */}
            <div style={{ marginBottom: '24px', borderBottom: '1px solid #E0E3E7', paddingBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 600, color: '#1F1F1F' }}>
                Account Access & Suspension
              </h4>

              {inspectingUser.banned ? (
                <div style={{ background: '#FCE8E6', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ color: '#C5221F', fontWeight: 600, fontSize: '0.86rem', marginBottom: '4px' }}>
                    This account is currently suspended.
                  </div>
                  {inspectingUser.banReason && (
                    <div style={{ fontSize: '0.8rem', color: '#5F6368' }}>
                      Reason: <em>"{inspectingUser.banReason}"</em>
                    </div>
                  )}
                  <button
                    onClick={() => handleSuspendToggle(inspectingUser, false)}
                    disabled={actionLoading}
                    className="btn btn-primary"
                    style={{ marginTop: '10px', padding: '6px 14px', fontSize: '0.8rem', background: '#137333', border: 'none' }}
                  >
                    Unsuspend & Restore Access
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Enter reason for suspension (optional)..."
                    value={banReasonText}
                    onChange={(e) => setBanReasonText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E0E3E7',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => handleSuspendToggle(inspectingUser, true, banReasonText)}
                    disabled={actionLoading}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem', color: '#C5221F', border: '1px solid #FCE8E6', background: '#FCE8E6', width: 'fit-content' }}
                  >
                    Suspend User Account
                  </button>
                </div>
              )}
            </div>

            {/* CONTROL SECTION 2: Storage Quota Allocation */}
            <div style={{ marginBottom: '24px', borderBottom: '1px solid #E0E3E7', paddingBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 600, color: '#1F1F1F' }}>
                Storage Quota Allocation
              </h4>
              <form onSubmit={(e) => e.preventDefault()}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={newQuotaGb}
                    onChange={(e) => setNewQuotaGb(Number(e.target.value))}
                    style={{
                      width: '120px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E0E3E7',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#5F6368', fontWeight: 600 }}>GB</span>

                  <button
                    type="button"
                    onClick={async () => {
                      const bytes = Math.round(newQuotaGb * 1024 * 1024 * 1024);
                      const res = await fetch(`/api/admin/user/${inspectingUser.id}/quota`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ storageQuotaBytes: bytes }),
                        credentials: 'include',
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const updatedUsers = users.map((u) => u.id === inspectingUser.id ? { ...u, storageQuotaBytes: bytes, storageQuotaFormatted: data.user?.storageQuotaFormatted || `${newQuotaGb} GB` } : u);
                        setUsers(updatedUsers);
                        setInspectingUser({ ...inspectingUser, storageQuotaBytes: bytes, storageQuotaFormatted: data.user?.storageQuotaFormatted || `${newQuotaGb} GB` });
                        setSuccessMsg(`Updated storage quota to ${newQuotaGb} GB`);
                        setTimeout(() => setSuccessMsg(null), 3000);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                  >
                    Save Quota
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {[15, 50, 100, 500, 1000].map((gb) => (
                    <button
                      key={gb}
                      type="button"
                      onClick={() => setNewQuotaGb(gb)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        border: newQuotaGb === gb ? '1px solid #0B57D0' : '1px solid #E0E3E7',
                        background: newQuotaGb === gb ? '#E8F0FE' : '#FFFFFF',
                        color: newQuotaGb === gb ? '#0B57D0' : '#3C4043',
                        cursor: 'pointer',
                      }}
                    >
                      {gb} GB
                    </button>
                  ))}
                </div>
              </form>
            </div>
            {/* CONTROL SECTION 2.5: Reset Password */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid #E0E3E7', marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', display: 'block', marginBottom: '8px' }}>
                Reset User Password
              </label>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setSuccessMsg(null);
                if (!adminResetPasswordVal || adminResetPasswordVal.length < 5) {
                  setError('Password must be at least 5 characters long');
                  return;
                }
                setActionLoading(true);
                try {
                  const res = await fetch(`/api/admin/user/${inspectingUser.id}/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword: adminResetPasswordVal }),
                  });
                  if (res.ok) {
                    setSuccessMsg(`Successfully reset password for ${inspectingUser.name}`);
                    setAdminResetPasswordVal('');
                    setTimeout(() => setSuccessMsg(null), 4000);
                  } else {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error || 'Failed to reset password');
                  }
                } catch (err: any) {
                  setError(err.message || 'Network error');
                } finally {
                  setActionLoading(false);
                }
              }} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={adminResetPasswordVal}
                  onChange={(e) => setAdminResetPasswordVal(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #DADCE0',
                    fontSize: '0.82rem',
                    color: '#1F1F1F',
                    background: '#FFFFFF',
                  }}
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  Reset
                </button>
              </form>
            </div>

            {/* CONTROL SECTION 3: Role & Danger Zone */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
                  User Role
                </label>
                <button
                  onClick={() => handleRoleToggle(inspectingUser)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid #E0E3E7',
                    background: inspectingUser.role === 'admin' ? '#FEF7E0' : '#E8F0FE',
                    color: inspectingUser.role === 'admin' ? '#B06000' : '#0B57D0',
                    cursor: 'pointer',
                  }}
                >
                  Switch Role to {inspectingUser.role === 'admin' ? 'USER' : 'ADMIN'}
                </button>
              </div>

              <button
                onClick={() => handleDeleteUser(inspectingUser)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.82rem', color: '#C5221F', background: '#FCE8E6', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={15} />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT USER CREATION MODAL */}
      {showCreateUserModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1450,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.22)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1F1F1F' }}>
                Create New User Account
              </h3>
              <button
                onClick={() => setShowCreateUserModal(false)}
                style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#3C4043', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E0E3E7',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#3C4043', marginBottom: '4px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E0E3E7',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#3C4043', marginBottom: '4px' }}>
                  Initial Password *
                </label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E0E3E7',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#3C4043', marginBottom: '4px' }}>
                    User Role
                  </label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as 'user' | 'admin')}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E0E3E7',
                      fontSize: '0.88rem',
                      outline: 'none',
                      background: '#FFFFFF',
                    }}
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#3C4043', marginBottom: '4px' }}>
                    Storage Quota (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={createQuotaGb}
                    onChange={(e) => setCreateQuotaGb(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E0E3E7',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="btn btn-primary"
                  style={{ padding: '9px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {creatingUser ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const statCardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E0E3E7',
  borderRadius: '16px',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
