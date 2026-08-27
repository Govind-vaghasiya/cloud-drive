import React, { useState } from 'react';
import { ShieldCheck, X, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import { useAuth } from '../../context/AuthContext';

interface TwoFactorSetupModalProps {
  onClose: () => void;
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({ onClose }) => {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<'prompt' | 'qr' | 'success'>('prompt');
  const [password, setPassword] = useState('');
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.twoFactor.enable({ password });
      if (res.error) {
        setError(res.error.message || 'Failed to initialize 2FA setup');
        setLoading(false);
        return;
      }

      const data = res.data as any;
      const uri = data?.totpURI || '';
      const codes = data?.backupCodes || [];

      setBackupCodes(codes);

      const qrRes = await fetch('/api/auth/2fa/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpURI: uri }),
        credentials: 'include',
      });

      if (qrRes.ok) {
        const qrJson = await qrRes.json();
        setQrCodeDataURL(qrJson.qrCode);
      }

      setStep('qr');
    } catch (err: any) {
      setError(err?.message || 'Error starting 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.twoFactor.verifyTotp({ code: verifyCode });
      if (res.error) {
        setError(res.error.message || 'Invalid 6-digit authentication code');
        setLoading(false);
        return;
      }

      await refreshUser();
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'Verification error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.twoFactor.disable({ password });
      if (res.error) {
        setError(res.error.message || 'Failed to disable 2FA');
        setLoading(false);
        return;
      }

      await refreshUser();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error disabling 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          maxWidth: '480px',
          width: '100%',
          padding: '24px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #E0E3E7',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
          color: '#1F1F1F',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#F0F4F9', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <ShieldCheck size={20} color="#0B57D0" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
              Two-Factor Authentication
            </h3>
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

        {/* Step 1: Status & Password Prompt */}
        {step === 'prompt' ? (
          user?.twoFactorEnabled ? (
            <form onSubmit={handleDisable2FA} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.88rem', color: '#5F6368', margin: 0 }}>
                2FA is currently <strong>active</strong> on your account. To disable it, confirm your current password:
              </p>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '4px' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ background: '#C5221F' }}>
                  {loading ? <Loader2 size={16} className="spin" /> : 'Disable 2FA'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStartSetup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.88rem', color: '#5F6368', margin: 0 }}>
                Protect your Cloud Drive account with TOTP authenticator apps (Google Authenticator, Authy, 1Password).
              </p>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '4px' }}>
                  Enter Password to Begin
                </label>
                <input
                  type="password"
                  required
                  placeholder="Your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 size={16} className="spin" /> : 'Continue'}
                </button>
              </div>
            </form>
          )
        ) : step === 'qr' ? (
          /* Step 2: Scan QR & Verify */
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
            <p style={{ fontSize: '0.88rem', color: '#5F6368', margin: 0 }}>
              Scan this QR code with your Authenticator app:
            </p>

            {qrCodeDataURL ? (
              <div style={{ padding: '12px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E0E3E7' }}>
                <img src={qrCodeDataURL} alt="2FA QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
              </div>
            ) : (
              <div style={{ padding: '2rem' }}>
                <Loader2 size={32} className="spin" color="#0B57D0" />
              </div>
            )}

            <div style={{ width: '100%' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '4px' }}>
                Enter 6-digit verification code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="123456"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                style={{
                  ...inputStyle,
                  fontSize: '1.2rem',
                  letterSpacing: '0.3em',
                  textAlign: 'center',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || verifyCode.length < 6}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px' }}
            >
              {loading ? <Loader2 size={16} className="spin" /> : 'Activate 2FA'}
            </button>
          </form>
        ) : (
          /* Step 3: Success & Backup Codes */
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ color: '#137333', display: 'flex', justifyContent: 'center' }}>
              <ShieldCheck size={48} />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
              2FA Successfully Enabled!
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#5F6368', margin: 0 }}>
              Save your backup recovery codes in a safe location:
            </p>

            {backupCodes.length > 0 && (
              <div style={{ background: '#F8FAFD', padding: '12px', borderRadius: '8px', border: '1px solid #E0E3E7', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5F6368', textTransform: 'uppercase' }}>Backup Codes</span>
                  <button
                    type="button"
                    onClick={copyBackupCodes}
                    style={{ background: 'none', border: 'none', color: '#0B57D0', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy All'}</span>
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontFamily: 'monospace', fontSize: '0.88rem', color: '#0B57D0' }}>
                  {backupCodes.map((code, i) => (
                    <div key={i}>{code}</div>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={onClose} className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#FFFFFF',
  border: '1px solid #747775',
  borderRadius: '8px',
  color: '#1F1F1F',
  fontSize: '0.95rem',
  outline: 'none',
};
