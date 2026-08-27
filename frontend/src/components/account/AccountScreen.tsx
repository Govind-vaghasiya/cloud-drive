import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Loader2 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface StorageCategory {
  key: string;
  label: string;
  bytes: number;
  bytesFormatted: string;
  count: number;
  color: string;
  percentage: number;
}

interface StorageStats {
  quotaBytes: number;
  quotaFormatted: string;
  usedBytes: number;
  usedFormatted: string;
  usagePercent: number;
  totalFiles: number;
  breakdown: StorageCategory[];
}

interface AuditLogItem {
  id: string;
  action: string;
  resourceId?: string | null;
  resourceType?: string | null;
  ipAddress?: string | null;
  details?: Record<string, any> | null;
  createdAt: string;
}

interface AccountScreenProps {
  onNavigateToAdmin?: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onNavigateToAdmin }) => {
  const { user, setShow2FASetup } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'storage' | 'security' | 'activity'>('storage');
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Audit logs state
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchStorageStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/account/storage', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching storage stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/account/audit-logs?page=${page}&limit=15`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchStorageStats();
  }, [fetchStorageStats]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchAuditLogs(1);
    }
  }, [activeTab, fetchAuditLogs]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);

    if (newPassword.length < 8) {
      setPwdMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setPwdMessage({ type: 'success', text: 'Password successfully updated!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdMessage({ type: 'error', text: err.message });
    } finally {
      setChangingPassword(false);
    }
  };

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Account & Settings
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#72777A' }}>
            Manage storage quota, security credentials, 2FA, and activity logs
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E0E3E7', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('storage')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'storage' ? '2px solid #0B57D0' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'storage' ? '#0B57D0' : '#5F6368',
            fontWeight: activeTab === 'storage' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          Storage Breakdown
        </button>

        <button
          onClick={() => setActiveTab('security')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'security' ? '2px solid #0B57D0' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'security' ? '#0B57D0' : '#5F6368',
            fontWeight: activeTab === 'security' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          Security & 2FA
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'activity' ? '2px solid #0B57D0' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'activity' ? '#0B57D0' : '#5F6368',
            fontWeight: activeTab === 'activity' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          Audit Activity Logs
        </button>

        {user?.role === 'admin' && onNavigateToAdmin && (
          <button
            onClick={onNavigateToAdmin}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: '2px solid transparent',
              background: '#FEF7E0',
              color: '#B06000',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.88rem',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: 'auto',
            }}
          >
            <ShieldCheck size={16} />
            <span>Admin Control Panel</span>
          </button>
        )}
      </div>

      {/* Tab 1: Storage Breakdown */}
      {activeTab === 'storage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loadingStats ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
              <Loader2 size={32} className="spin" color="#1A73E8" />
            </div>
          ) : stats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Storage Overview Card */}
              <div style={{ background: '#F8FAFD', padding: '20px', borderRadius: '12px', border: '1px solid #E0E3E7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1F1F1F' }}>
                    {stats.usedFormatted} of {stats.quotaFormatted} used
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#5F6368' }}>
                    {stats.usagePercent}% used
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '8px', background: '#E0E3E7', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.usagePercent}%`, height: '100%', background: '#1A73E8', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Category Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {stats.breakdown.map((cat) => (
                  <div
                    key={cat.key}
                    style={{
                      background: '#FFFFFF',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid #E0E3E7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1F1F1F' }}>
                        {cat.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#72777A' }}>
                        {cat.count} files
                      </div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A73E8' }}>
                      {cat.bytesFormatted}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Tab 2: Security */}
      {activeTab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Password Change Card */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E0E3E7' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F1F1F', margin: '0 0 16px 0' }}>
              Change Password
            </h3>

            {pwdMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '0.85rem',
                  background: pwdMessage.type === 'success' ? '#E6F4EA' : '#FCE8E6',
                  color: pwdMessage.type === 'success' ? '#137333' : '#C5221F',
                }}
              >
                {pwdMessage.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="btn btn-primary"
                style={{ marginTop: '8px', padding: '10px' }}
              >
                {changingPassword ? <Loader2 size={16} className="spin" /> : 'Update Password'}
              </button>
            </form>
          </div>

          {/* 2FA Card */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E0E3E7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F1F1F', margin: '0 0 12px 0' }}>
                Two-Factor Authentication (2FA)
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#5F6368', margin: '0 0 16px 0' }}>
                Add an extra layer of security using Google Authenticator or any TOTP app.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: user?.twoFactorEnabled ? '#E6F4EA' : '#FCE8E6',
                  color: user?.twoFactorEnabled ? '#137333' : '#C5221F',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {user?.twoFactorEnabled ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                <span>{user?.twoFactorEnabled ? '2FA is Active' : '2FA is Disabled'}</span>
              </div>
            </div>

            <button
              onClick={() => setShow2FASetup(true)}
              className="btn btn-secondary"
              style={{ marginTop: '20px', padding: '10px' }}
            >
              {user?.twoFactorEnabled ? 'Manage 2FA' : 'Setup 2FA Protection'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Activity Logs */}
      {activeTab === 'activity' && (
        <div>
          {loadingLogs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
              <Loader2 size={32} className="spin" color="#1A73E8" />
            </div>
          ) : (
            <div style={{ border: '1px solid #E0E3E7', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr 140px',
                  padding: '10px 16px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#5F6368',
                  borderBottom: '1px solid #E0E3E7',
                  background: '#F8FAFD',
                }}
              >
                <span>Timestamp</span>
                <span>Action Description</span>
                <span>IP Address</span>
              </div>

              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 140px',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderBottom: '1px solid #F1F3F4',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ color: '#72777A', fontSize: '0.78rem' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                  <div style={{ fontWeight: 500, color: '#1F1F1F' }}>
                    {log.action} {log.details?.filename ? `(${log.details.filename})` : ''}
                  </div>
                  <div style={{ color: '#72777A', fontSize: '0.78rem' }}>
                    {log.ipAddress || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #E0E3E7',
  fontSize: '0.9rem',
  outline: 'none',
};
