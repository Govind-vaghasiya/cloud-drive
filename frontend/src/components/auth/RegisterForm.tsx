import React, { useState } from 'react';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import { useAuth } from '../../context/AuthContext';

// Invite-Only Registration Form with Single-Use OTP Passcode verification
interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { refreshUser } = useAuth();
  const codeFromUrl = new URLSearchParams(window.location.search).get('code') || new URLSearchParams(window.location.search).get('invite') || '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inviteCode.trim()) {
      setError('A single-use invite passcode (OTP) is required to register');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      // First validate invite passcode
      const valRes = await fetch('/api/auth/validate-invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });

      let valData: any = {};
      try {
        valData = await valRes.json();
      } catch (parseError) {
        setError('An unexpected server error occurred. Please contact the administrator.');
        setLoading(false);
        return;
      }

      if (!valRes.ok || !valData.valid) {
        setError(valData.error || 'Invalid or expired invite passcode');
        setLoading(false);
        return;
      }

      // Proceed with sign up
      const res = await authClient.signUp.email({
        name,
        email,
        password,
        inviteCode: inviteCode.trim(),
      } as any);

      if (res.error) {
        setError(res.error.message || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      await refreshUser();
    } catch (err: any) {
      setError(err?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto', width: '100%' }}>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '40px',
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
          Create an Account
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#5F6368', margin: '0 0 24px 0' }}>
          to get started with Cloud Drive
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
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0B57D0', display: 'block' }}>
                Invite Passcode (6-Digit OTP)
              </label>
              <span style={{ fontSize: '0.72rem', color: '#B06000', fontWeight: 500 }}>Required</span>
            </div>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.trim())}
              placeholder="e.g. 839201"
              required
              maxLength={12}
              style={{
                ...authInputStyle,
                letterSpacing: '0.1em',
                fontWeight: 600,
                borderColor: '#0B57D0',
                background: '#F8FAFD',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Govind Vaghasiya"
              required
              style={authInputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="govind@example.com"
              required
              style={authInputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                style={{ ...authInputStyle, paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#80868B',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '4px' }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                style={{ ...authInputStyle, paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#80868B',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{ background: 'none', border: 'none', color: '#0B57D0', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Sign in instead
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.9rem' }}
            >
              {loading ? <Loader2 size={16} className="spin" /> : 'Create'}
            </button>
          </div>
        </form>
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
