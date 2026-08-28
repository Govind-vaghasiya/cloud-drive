import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Lock, 
  Unlock, 
  FileText, 
  AlertCircle, 
  Loader2, 
} from 'lucide-react';
import { getFileIcon } from './FileCard';

interface PublicSharePageProps {
  token: string;
}

interface ShareMetaResponse {
  passwordRequired: boolean;
  resourceType?: string;
  ownerName?: string;
  error?: string;
  share?: {
    id: string;
    permission: 'view' | 'edit';
    expiresAt?: string | null;
    createdAt: string;
    ownerName: string;
  };
  resource?: {
    id: string;
    type: 'file' | 'folder';
    name: string;
    mimeType?: string;
    size?: number;
    sizeFormatted?: string;
    thumbnailPath?: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export const PublicSharePage: React.FC<PublicSharePageProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<ShareMetaResponse | null>(null);
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unlockedPassword, setUnlockedPassword] = useState<string>('');

  const fetchMeta = async (pwd?: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (pwd) {
        headers['x-share-password'] = pwd;
      }

      const res = await fetch(`/api/s/${token}/meta`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: pwd || '' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to load shared resource');
        setMeta(data);
      } else {
        setMeta(data);
        if (pwd && !data.passwordRequired) {
          setUnlockedPassword(pwd);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
      setUnlocking(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, [token]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setUnlocking(true);
    fetchMeta(password.trim());
  };

  const getDownloadUrl = () => {
    const pwdParam = unlockedPassword ? `?pwd=${encodeURIComponent(unlockedPassword)}` : '';
    return `/api/s/${token}/download${pwdParam}`;
  };

  const getPreviewUrl = () => {
    const pwdParam = unlockedPassword ? `?pwd=${encodeURIComponent(unlockedPassword)}` : '';
    return `/api/s/${token}/preview${pwdParam}`;
  };

  if (loading && !meta) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '12px' }}>
        <Loader2 size={32} className="spin" color="#3b82f6" />
        <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>Accessing shared item...</span>
      </div>
    );
  }

  // Error State: Expired, not found or revoked
  if (errorMessage && !meta?.passwordRequired) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div 
          className="glass-card"
          style={{
            maxWidth: '480px',
            width: '100%',
            padding: '2.5rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(23, 30, 48, 0.95)',
          }}
        >
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#ef4444' }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px', color: '#f87171' }}>
            Link Unavailable
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {errorMessage}
          </p>
          <a href="/" className="btn btn-primary" style={{ display: 'inline-flex', padding: '10px 20px' }}>
            Go to Cloud Drive
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)' }}>
      {/* Top Header */}
      <header
        style={{
          padding: '1.25rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(10px)',
          background: 'rgba(15, 23, 42, 0.8)',
        }}
      >
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-white.png" alt="Govind Drive" style={{ height: '36px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }} />
        </a>

        <a href="/" className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
          Sign In
        </a>
      </header>

      {/* Main Body */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        {/* State A: Password Required */}
        {meta?.passwordRequired ? (
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '36px 32px',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)',
              textAlign: 'center',
            }}
          >
            {/* Lock icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#FFF3E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: '#E65100',
              }}
            >
              <Lock size={30} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1F1F1F', margin: '0 0 8px' }}>
              Password Protected
            </h2>
            <p style={{ color: '#5F6368', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>
              {meta.ownerName
                ? `${meta.ownerName} shared a protected item with you.`
                : 'This shared item requires a password to view.'}
            </p>

            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  background: '#FCE8E6',
                  border: '1px solid #FAD2CF',
                  borderRadius: '8px',
                  color: '#C5221F',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  textAlign: 'left',
                }}
              >
                <span>⚠ {errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #DADCE0',
                    background: '#F8FAFD',
                    color: '#1F1F1F',
                    fontSize: '0.95rem',
                    outline: 'none',
                    textAlign: 'center',
                    letterSpacing: '2px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={unlocking || !password.trim()}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: unlocking || !password.trim() ? '#DADCE0' : '#1A73E8',
                  color: unlocking || !password.trim() ? '#80868B' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: unlocking || !password.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease',
                }}
              >
                {unlocking ? <Loader2 size={18} className="spin" /> : <Unlock size={18} />}
                <span>Unlock & View</span>
              </button>
            </form>
          </div>
        ) : meta?.resource ? (
          /* State B: Unlocked / Public Item View */
          <div
            className="glass-card"
            style={{
              maxWidth: '860px',
              width: '100%',
              padding: '2rem',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(23, 30, 48, 0.95)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            {/* Resource Info Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getFileIcon(meta.resource.mimeType || '', meta.resource.name)}
                </div>

                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {meta.resource.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {meta.resource.sizeFormatted && <span>{meta.resource.sizeFormatted}</span>}
                    {meta.share?.ownerName && (
                      <>
                        <span>•</span>
                        <span>Shared by <strong>{meta.share.ownerName}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action: Download */}
              <a
                href={getDownloadUrl()}
                className="btn btn-primary"
                style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}
              >
                <Download size={18} />
                <span>Download File</span>
              </a>
            </div>

            {/* Media Inline Preview Area */}
            {meta.resource.type === 'file' && meta.resource.mimeType && (
              <div
                style={{
                  width: '100%',
                  minHeight: '320px',
                  maxHeight: '560px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {meta.resource.mimeType.startsWith('image/') ? (
                  <img
                    src={getPreviewUrl()}
                    alt={meta.resource.name}
                    style={{ maxWidth: '100%', maxHeight: '540px', objectFit: 'contain' }}
                  />
                ) : meta.resource.mimeType.startsWith('video/') ? (
                  <video
                    controls
                    src={getPreviewUrl()}
                    style={{ maxWidth: '100%', maxHeight: '540px', borderRadius: '8px' }}
                  />
                ) : meta.resource.mimeType.startsWith('audio/') ? (
                  <div style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                    <audio controls src={getPreviewUrl()} style={{ width: '100%' }} />
                  </div>
                ) : meta.resource.mimeType === 'application/pdf' ? (
                  <iframe
                    src={getPreviewUrl()}
                    title="PDF Preview"
                    style={{ width: '100%', height: '500px', border: 'none', borderRadius: '8px' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', padding: '3rem' }}>
                    <FileText size={48} color="#94a3b8" />
                    <span>Click Download to view this file</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
};
