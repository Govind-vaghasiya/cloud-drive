import React, { useState, useEffect } from 'react';
import { Shield, X, HardDrive, Check, AlertCircle, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  storageQuotaFormatted: string;
  storageUsedFormatted: string;
  twoFactorEnabled: boolean;
}

export const AdminQuotaModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { refreshUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [customQuotas, setCustomQuotas] = useState<{ [userId: string]: number }>({});
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        const quotaMap: { [userId: string]: number } = {};
        data.users.forEach((u: UserItem) => {
          quotaMap[u.id] = Math.round(u.storageQuotaBytes / (1024 * 1024 * 1024));
        });
        setCustomQuotas(quotaMap);
      } else {
        setError('Unauthorized or failed to load users');
      }
    } catch {
      setError('Unable to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateQuota = async (userId: string) => {
    setSavingId(userId);
    setError(null);
    setSuccessMsg(null);

    const gbVal = customQuotas[userId] || 10;
    const bytes = gbVal * 1024 * 1024 * 1024;

    try {
      const res = await fetch(`/api/admin/users/${userId}/quota`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotaBytes: bytes }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update quota');
      }

      setSuccessMsg(`Updated quota for user to ${gbVal} GB!`);
      await fetchUsers();
      await refreshUser();
    } catch (err: any) {
      setError(err?.message || 'Error updating quota');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '640px',
          width: '100%',
          padding: '24px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #E0E3E7',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
          color: '#1F1F1F',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#F0F4F9', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <Shield size={20} color="#0B57D0" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
                Storage Quota Management
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#5F6368' }}>
                Admin control for user storage capacities
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#5F6368',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#FCE8E6',
              border: '1px solid #FAD2CF',
              color: '#C5221F',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#E6F4EA',
              border: '1px solid #CEEAD6',
              color: '#137333',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '16px',
            }}
          >
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#5F6368', gap: '8px' }}>
            <Loader2 size={24} className="spin" color="#0B57D0" />
            <span>Loading user accounts...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  background: '#F8FAFD',
                  border: '1px solid #E0E3E7',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1F1F1F' }}>{u.name}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: u.role === 'admin' ? '#E8F0FE' : '#F1F3F4',
                        color: u.role === 'admin' ? '#0B57D0' : '#5F6368',
                      }}
                    >
                      {u.role.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#5F6368' }}>{u.email}</div>
                  <div style={{ fontSize: '0.78rem', color: '#5F6368', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HardDrive size={13} />
                    Current Quota: <strong>{u.storageQuotaFormatted}</strong> (Used: {u.storageUsedFormatted})
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #747775', borderRadius: '8px', padding: '4px 8px' }}>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={customQuotas[u.id] || 10}
                      onChange={(e) => setCustomQuotas({ ...customQuotas, [u.id]: parseInt(e.target.value, 10) || 0 })}
                      style={{
                        width: '60px',
                        background: 'transparent',
                        border: 'none',
                        color: '#1F1F1F',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#5F6368', marginLeft: '6px' }}>GB</span>
                  </div>

                  <button
                    onClick={() => handleUpdateQuota(u.id)}
                    disabled={savingId === u.id}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    {savingId === u.id ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
