import React, { useState, useEffect } from 'react';
import { X, History, RotateCcw, Download, Clock, User, Check, Loader2, AlertCircle } from 'lucide-react';

interface VersionItem {
  id: string;
  versionNumber: number;
  size: number;
  sizeFormatted: string;
  authorName: string;
  authorEmail?: string;
  createdAt: string;
  isCurrent: boolean;
}

interface VersionHistoryModalProps {
  fileId: string;
  fileName: string;
  onClose: () => void;
  onRestored?: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  fileId,
  fileName,
  onClose,
  onRestored,
}) => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/versions`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch version history');
      }
      const data = await res.json();
      setVersions(data.versions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [fileId]);

  const handleRestore = async (version: VersionItem) => {
    if (version.isCurrent) return;
    setRestoringId(version.id);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/versions/${version.id}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore version');
      }
      setSuccessMessage(`Restored version ${version.versionNumber}`);
      await fetchVersions();
      if (onRestored) onRestored();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to restore version');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={20} color="#3b82f6" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Version History</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {successMessage && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
              }}
            >
              <Check size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
              <Loader2 size={32} className="spin" color="#3b82f6" />
            </div>
          ) : versions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
              No version history available for this file.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: ver.isCurrent ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: ver.isCurrent ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  {/* Left Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Version {ver.versionNumber}
                      </span>
                      {ver.isCurrent && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                          }}
                        >
                          Current
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {ver.sizeFormatted}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {new Date(ver.createdAt).toLocaleString()}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        {ver.authorName}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!ver.isCurrent && (
                      <>
                        <a
                          href={`/api/files/${fileId}/versions/${ver.id}/download`}
                          download
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Download this version"
                        >
                          <Download size={13} />
                        </a>
                        <button
                          onClick={() => handleRestore(ver)}
                          disabled={restoringId === ver.id}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Restore this version"
                        >
                          {restoringId === ver.id ? (
                            <Loader2 size={13} className="spin" />
                          ) : (
                            <RotateCcw size={13} />
                          )}
                          <span>Restore</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
