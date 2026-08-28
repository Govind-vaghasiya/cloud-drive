import React, { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { authClient } from '../../lib/auth-client';

interface ResetPasswordPageProps {
  token: string;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or expired password reset token.');
      return;
    }
    if (password.length < 5) {
      setError('Password must be at least 5 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token: token,
      });

      if (res.error) {
        setError(res.error.message || 'Failed to reset password. The link may have expired.');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'An error occurred during password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFD', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Brand Logo */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <img
            src="/logo-long.png"
            alt="Govind Drive"
            style={{ maxHeight: '48px', maxWidth: '280px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', width: '100%' }}>
          <div style={{ background: '#E8F0FE', padding: '10px', borderRadius: '12px' }}>
            <KeyRound size={24} color="#1A73E8" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>Choose New Password</h3>
            <p style={{ fontSize: '0.8rem', color: '#5F6368', margin: '2px 0 0 0' }}>
              Set a secure new password for your account
            </p>
          </div>
        </div>

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
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#E6F4EA',
                color: '#137333',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={18} />
              <span>Password successfully reset! You can now log in.</span>
            </div>
            <button onClick={handleGoToLogin} className="btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.9rem', fontWeight: 600 }}>
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3C4043' }}>New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 5 characters"
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #DADCE0',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3C4043' }}>Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #DADCE0',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.9rem', fontWeight: 600, marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? <Loader2 size={16} className="spin" /> : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
