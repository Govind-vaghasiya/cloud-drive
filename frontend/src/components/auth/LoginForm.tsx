import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import { useAuth } from '../../context/AuthContext';

interface LoginFormProps {
  onSwitchToRegister?: () => void;
  onForgotPassword: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onForgotPassword }) => {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (requires2FA) {
        const res = await authClient.twoFactor.verifyTotp({ code: totpCode });
        if (res.error) {
          setError(res.error.message || 'Invalid 2FA code');
          setLoading(false);
          return;
        }
        await refreshUser();
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) {
          setError(res.error.message || 'Invalid email or password');
          setLoading(false);
          return;
        }
        const data = res.data as any;
        if (data?.twoFactorRedirect || data?.twoFactorRequired) {
          setRequires2FA(true);
          setLoading(false);
          return;
        }
        await refreshUser();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '4rem auto', width: '100%' }}>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '40px',
          border: '1px solid #E0E3E7',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Brand Logo (Long Version) */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <img
            src="/logo-long.png"
            alt="Govind Drive"
            style={{ maxHeight: '48px', maxWidth: '280px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1F1F1F', margin: '0 0 6px 0' }}>
          Sign in
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#5F6368', margin: '0 0 24px 0' }}>
          to continue to Cloud Drive
        </p>

        {error && (
          <div
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#FCE8E6',
              color: '#C5221F',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!requires2FA ? (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={authInputStyle}
                />
              </div>

              <div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={authInputStyle}
                />
              </div>
            </>
          ) : (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
                6-digit 2FA Code
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                required
                autoFocus
                style={authInputStyle}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onForgotPassword}
              style={{ background: 'none', border: 'none', color: '#0B57D0', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.9rem' }}
            >
              {loading ? <Loader2 size={16} className="spin" /> : requires2FA ? 'Verify' : 'Sign in'}
            </button>
          </div>
        </form>

        {onSwitchToRegister && (
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: '#5F6368' }}>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: '#0B57D0',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Create account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const authInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid #747775',
  fontSize: '0.95rem',
  color: '#1F1F1F',
  outline: 'none',
};
