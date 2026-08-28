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
  const { user, refreshUser, setShow2FASetup } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'storage' | 'security' | 'activity'>('profile');
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Profile update states
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState((user as any)?.phoneNumber || '');
  const [profileBirthdate, setProfileBirthdate] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Image cropping states
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropZoomPercent, setCropZoomPercent] = useState(0);
  const [cropPan, setCropPan] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStartCrop, setDragStartCrop] = useState({ x: 0, y: 0 });
  const [selectedFileName, setSelectedFileName] = useState('avatar.png');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const cropZoom = cropZoomPercent >= 0 
    ? 1.0 + (cropZoomPercent / 100) * 2.0 
    : 1.0 + (cropZoomPercent / 100) * 0.8;

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Audit logs state
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone((user as any).phoneNumber || '');
      if ((user as any).birthdate) {
        const d = new Date((user as any).birthdate);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          setProfileBirthdate(`${year}-${month}-${day}`);
        }
      }
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (!evt.target?.result) return;
      setCropSrc(evt.target.result as string);
      setCropZoomPercent(0);
      setCropPan({ x: 0, y: 0 });
      // Reset input value AFTER reading so the file reference stays alive
      e.target.value = '';
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Formats and validates a phone number string.
   * - Accepts digits, +, spaces, -, (, )
   * - Auto-formats NANP (+1) as +1 (XXX) XXX-XXXX
   * - For other country codes formats as +CC XXXXXXXXXX
   * - Returns { formatted, valid } where valid means empty OR well-formed
   */
  const formatPhoneNumber = (raw: string): { formatted: string; error: string | null } => {
    // Allow empty (optional field)
    if (!raw || raw.trim() === '') return { formatted: '', error: null };

    // Strip everything except digits and leading +
    const hasPlus = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');

    if (digits.length < 7) {
      return { formatted: raw, error: 'Phone number is too short' };
    }
    if (digits.length > 15) {
      return { formatted: raw, error: 'Phone number is too long (max 15 digits)' };
    }

    // North-American Numbering Plan: country code 1 and 10 digit local
    if (hasPlus && digits.startsWith('1') && digits.length === 11) {
      const area = digits.slice(1, 4);
      const mid  = digits.slice(4, 7);
      const end  = digits.slice(7, 11);
      return { formatted: `+1 (${area}) ${mid}-${end}`, error: null };
    }

    // Generic international: keep + prefix, group remaining digits in blocks of 4
    if (hasPlus) {
      const grouped = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
      return { formatted: `+${grouped}`, error: null };
    }

    // Domestic format without country code — require at least 10 digits
    if (digits.length < 10) {
      return { formatted: raw, error: 'Please include country code (e.g. +1 555 012 3456)' };
    }
    const area = digits.slice(0, 3);
    const mid  = digits.slice(3, 6);
    const end  = digits.slice(6, 10);
    const ext  = digits.slice(10);
    return { formatted: `(${area}) ${mid}-${end}${ext ? ` x${ext}` : ''}`, error: null };
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow typing freely — only validate once the user leaves the field
    // But strip non-phone characters to prevent random text
    const cleaned = raw.replace(/[^\d+()\s\-]/g, '');
    setProfilePhone(cleaned);
    // Inline validation while typing (only show error after 3 chars)
    if (cleaned.length > 3) {
      const { error } = formatPhoneNumber(cleaned);
      setPhoneError(error);
    } else {
      setPhoneError(null);
    }
  };

  const handlePhoneBlur = () => {
    if (!profilePhone.trim()) { setPhoneError(null); return; }
    const { formatted, error } = formatPhoneNumber(profilePhone);
    setProfilePhone(formatted);
    setPhoneError(error);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    // Validate phone number (optional)
    if (profilePhone && profilePhone.trim() !== '') {
      const { error } = formatPhoneNumber(profilePhone.trim());
      if (error) {
        setPhoneError(error);
        setProfileMessage({ type: 'error', text: `Phone number: ${error}` });
        return;
      }
    }

    // Validate birthdate (optional)
    if (profileBirthdate && profileBirthdate.trim() !== '') {
      const parsedDate = Date.parse(profileBirthdate.trim());
      if (isNaN(parsedDate)) {
        setProfileMessage({ type: 'error', text: 'Please enter a valid birthdate (YYYY-MM-DD)' });
        return;
      }
    }

    setUpdatingProfile(true);

    try {
      const formData = new FormData();
      formData.append('name', profileName);
      formData.append('phoneNumber', profilePhone);
      formData.append('birthdate', profileBirthdate);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setProfileMessage({ type: 'success', text: 'Profile successfully updated!' });
      await refreshUser();
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'An error occurred' });
    } finally {
      setUpdatingProfile(false);
    }
  };

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
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid #0B57D0' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'profile' ? '#0B57D0' : '#5F6368',
            fontWeight: activeTab === 'profile' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          Personal Info
        </button>

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

      {/* Tab 0: Personal Info */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#F8FAFD', padding: '24px', borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1F1F1F', margin: '0 0 16px 0' }}>
              Personal Details
            </h2>

            {/* Profile Image & Upload — outside form to prevent unmount on re-render */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '4px' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#0B57D0',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '2rem',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : user?.image ? (
                  <img src={user.image} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  user?.name ? user.name.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="avatar-file-input"
                  style={{
                    background: '#1A73E8',
                    color: '#FFFFFF',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-block',
                    textAlign: 'center',
                  }}
                >
                  Change photo
                </label>
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#5F6368' }}>
                  JPG, PNG or GIF. Max 5MB.
                </span>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Avatar placeholder for spacing */}

              {profileMessage && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: profileMessage.type === 'success' ? '#E6F4EA' : '#FCE8E6',
                    color: profileMessage.type === 'success' ? '#137333' : '#C5221F',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  {profileMessage.text}
                </div>
              )}

              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3C4043' }}>Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #DADCE0',
                    fontSize: '0.9rem',
                    background: '#FFFFFF',
                    color: '#3C4043',
                  }}
                />
              </div>

              {/* Phone Number */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3C4043' }}>
                  Phone Number <span style={{ fontWeight: 400, color: '#80868B', fontSize: '0.78rem' }}>(optional)</span>
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="e.g. +1 555 012 3456"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${phoneError ? '#D93025' : '#DADCE0'}`,
                    fontSize: '0.9rem',
                    background: '#FFFFFF',
                    color: '#3C4043',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                {phoneError ? (
                  <span style={{ fontSize: '0.76rem', color: '#D93025', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠ {phoneError}
                  </span>
                ) : profilePhone && !phoneError ? (
                  <span style={{ fontSize: '0.76rem', color: '#1E8E3E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✓ Looks good
                  </span>
                ) : (
                  <span style={{ fontSize: '0.76rem', color: '#80868B' }}>
                    Include country code, e.g. +1 (555) 012-3456 or +44 7911 123456
                  </span>
                )}
              </div>

              {/* Birthdate */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3C4043' }}>Birthdate</label>
                <input
                  type="date"
                  value={profileBirthdate}
                  onChange={(e) => setProfileBirthdate(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #DADCE0',
                    fontSize: '0.9rem',
                    background: '#FFFFFF',
                    color: '#3C4043',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={updatingProfile}
                style={{
                  background: '#1A73E8',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {updatingProfile ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Updating profile...</span>
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

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
      {/* Profile Picture Resize/Crop Modal */}
      {showCropModal && cropSrc && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            padding: '24px',
            width: '100%',
            maxWidth: '360px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1F1F1F', marginBottom: '16px', alignSelf: 'flex-start' }}>
              Crop Profile Picture
            </h3>

            {/* Circular Crop Frame */}
            <div
              onMouseDown={(e) => {
                setIsDraggingCrop(true);
                setDragStartCrop({ x: e.clientX - cropPan.x, y: e.clientY - cropPan.y });
              }}
              onMouseMove={(e) => {
                if (isDraggingCrop) {
                  setCropPan({ x: e.clientX - dragStartCrop.x, y: e.clientY - dragStartCrop.y });
                }
              }}
              onMouseUp={() => setIsDraggingCrop(false)}
              onMouseLeave={() => setIsDraggingCrop(false)}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                setIsDraggingCrop(true);
                setDragStartCrop({ x: touch.clientX - cropPan.x, y: touch.clientY - cropPan.y });
              }}
              onTouchMove={(e) => {
                if (isDraggingCrop) {
                  const touch = e.touches[0];
                  setCropPan({ x: touch.clientX - dragStartCrop.x, y: touch.clientY - dragStartCrop.y });
                }
              }}
              onTouchEnd={() => setIsDraggingCrop(false)}
              style={{
                width: '250px',
                height: '250px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid #1A73E8',
                background: '#F0F4F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'move',
                userSelect: 'none',
              }}
            >
              <img
                src={cropSrc}
                alt="Crop preview"
                draggable={false}
                style={{
                  transform: `translate(${cropPan.x}px, ${cropPan.y}px) scale(${cropZoom})`,
                  transformOrigin: 'center center',
                  maxHeight: 'none',
                  maxWidth: 'none',
                  width: '250px',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            </div>

            {/* Zoom Slider */}
            <div style={{ width: '100%', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#5F6368', fontWeight: 600 }}>
                <span>Zoom</span>
                <span>{cropZoomPercent > 0 ? `+${cropZoomPercent}%` : `${cropZoomPercent}%`}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={cropZoomPercent}
                onChange={(e) => setCropZoomPercent(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  accentColor: '#1A73E8',
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', width: '100%', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setShowCropModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '10px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 256;
                  canvas.height = 256;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, 256, 256);
                    ctx.translate(128, 128);
                    
                    const scaleFactor = 256 / 250;
                    ctx.translate(cropPan.x * scaleFactor, cropPan.y * scaleFactor);
                    ctx.scale(cropZoom * scaleFactor, cropZoom * scaleFactor);
                    
                    const img = new Image();
                    img.onload = () => {
                      const aspect = img.width / img.height;
                      // Display size in the canvas calculation MUST always match browser styling width = 250px
                      const drawWidth = 250;
                      const drawHeight = 250 / aspect;
                      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
                      
                      canvas.toBlob((blob) => {
                        if (blob) {
                          const croppedFile = new File([blob], selectedFileName, { type: 'image/png' });
                          setAvatarFile(croppedFile);
                          setPreviewUrl(URL.createObjectURL(croppedFile));
                          setShowCropModal(false);
                        }
                      }, 'image/png');
                    };
                    img.src = cropSrc;
                  }
                }}
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px' }}
              >
                Save Photo
              </button>
            </div>
          </div>
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
