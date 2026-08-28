import React, { useState, useEffect } from 'react';
import { Activity, X, FileText, Upload, Trash2, Edit3, ShieldCheck, Loader2 } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  resource_type?: string;
  resourceType?: string;
  created_at?: string;
  createdAt?: string;
  details: Record<string, any>;
}

interface ActivityPanelProps {
  onClose: () => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/account/audit-logs?page=1&limit=20', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.logs) {
          setLogs(data.logs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getActionIcon = (action: string) => {
    if (action.includes('UPLOAD')) return <Upload size={14} color="#1A73E8" />;
    if (action.includes('DELETE')) return <Trash2 size={14} color="#C5221F" />;
    if (action.includes('OFFICE') || action.includes('EDIT')) return <Edit3 size={14} color="#0F9D58" />;
    if (action.includes('AUTH') || action.includes('LOGIN')) return <ShieldCheck size={14} color="#137333" />;
    return <FileText size={14} color="#5F6368" />;
  };

  const formatActionTitle = (action: string, details: Record<string, any>) => {
    if (action === 'FILE_UPLOAD') return `Uploaded ${details.filename || 'a file'}`;
    if (action === 'FILE_DELETE') return `Deleted ${details.filename || 'a file'}`;
    if (action === 'OFFICE_SAVE') return `Edited ${details.filename || 'document'}`;
    if (action === 'USER_LOGIN') return 'Logged in';
    if (action === 'USER_REGISTER') return 'Account created';
    return action.replace(/_/g, ' ').toLowerCase();
  };

  return (
    <div
      style={{
        width: '300px',
        flexShrink: 0,
        background: '#FFFFFF',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #E0E3E7',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#1A73E8" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Activity
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#5F6368',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Loader2 size={24} className="spin" color="#1A73E8" />
          </div>
        ) : logs.length === 0 ? (
          /* Empty state matching reference */
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '12px',
              padding: '2rem 1rem',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12H12L16 4L24 20L30 8L34 12H46" stroke="#D3E3FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#72777A', maxWidth: '180px', margin: 0 }}>
              No recent activities for your account.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '0.82rem',
                }}
              >
                <div
                  style={{
                    padding: '6px',
                    borderRadius: '50%',
                    background: '#F0F4F9',
                    display: 'flex',
                    marginTop: '2px',
                  }}
                >
                  {getActionIcon(log.action)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: '#1F1F1F', wordBreak: 'break-word' }}>
                    {formatActionTitle(log.action, log.details || {})}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#72777A', marginTop: '2px' }}>
                    {log.createdAt || log.created_at ? new Date(log.createdAt || log.created_at!).toLocaleString() : 'Just now'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
