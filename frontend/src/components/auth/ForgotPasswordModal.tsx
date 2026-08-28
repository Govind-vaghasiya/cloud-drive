import React, { useState } from 'react';
import { KeyRound, X, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ForgotPasswordModalProps {
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message || d.error || 'Failed to send reset request. Please try again.');
        setLoading(false);
        return;
      }

      // Also fetch the reset URL from backend (simulated email system)
      try {
        const stored = await fetch('/api/auth/debug/last-reset-url', { credentials: 'include' });
        if (stored.ok) {
          const json = await stored.json();
          if (json.url) setResetUrl(json.url);
        }
      } catch (_) { /* ignore – not critical */ }

      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E8EAED',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: '#F1F3F4',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#5F6368',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              background: '#E8F0FE',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <KeyRound size={22} color="#1A73E8" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F1F1F', margin: 0 }}>
              Reset Password
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#5F6368', margin: '2px 0 0' }}>
              Recover access to your account
            </p>
          </div>
        </div>

        {/* Error */}
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

        {sent ? (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                background: '#E6F4EA',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={32} color="#137333" />
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1F1F1F', margin: '0 0 8px' }}>
              Request Processed
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#5F6368', marginBottom: '20px', lineHeight: 1.5 }}>
              If an account with <strong style={{ color: '#1F1F1F' }}>{email}</strong> exists,
              a password reset link has been generated.
            </p>

            {/* Developer/Admin shortcut — shows reset URL since email is simulated */}
            {resetUrl && (
              <div
                style={{
                  background: '#FFF8E1',
                  border: '1px solid #FFD54F',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  textAlign: 'left',
                }}
              >
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7B5E0E', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚠ Dev Mode – Simulated Email Link
                </p>
                <a
                  href={resetUrl}
                  style={{
                    fontSize: '0.8rem',
                    color: '#1A73E8',
                    wordBreak: 'break-all',
                    textDecoration: 'none',
                    fontFamily: 'monospace',
                  }}
                >
                  {resetUrl}
                </a>
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                width: '100%',
                background: '#1A73E8',
                border: 'none',
                color: '#fff',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          /* Form state */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{ color: '#5F6368', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
              Enter your account email and we'll generate a password reset link.
            </p>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#3C4043',
                  marginBottom: '6px',
                }}
              >
                Account Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="#80868B"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 36px',
                    border: '1px solid #DADCE0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#1F1F1F',
                    background: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                background: loading || !email.trim() ? '#DADCE0' : '#1A73E8',
                border: 'none',
                color: loading || !email.trim() ? '#80868B' : '#fff',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.15s ease',
              }}
            >
              {loading ? <Loader2 size={18} className="spin" /> : null}
              <span>{loading ? 'Sending…' : 'Send Reset Link'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
