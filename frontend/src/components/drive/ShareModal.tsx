import React, { useState, useEffect } from 'react';
import { 
  X, 
  Globe, 
  Users, 
  Copy, 
  Check, 
  Trash2, 
  Loader2, 
  UserPlus
} from 'lucide-react';

interface ShareModalProps {
  resourceId: string;
  resourceName: string;
  resourceType: 'file' | 'folder';
  onClose: () => void;
}

interface ShareData {
  id: string;
  token?: string;
  type: 'public' | 'private';
  permission: 'view' | 'edit';
  expiresAt?: string | null;
  hasPassword?: boolean;
  publicUrl?: string | null;
  recipients?: Array<{ id: string; name: string; email: string }>;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  resourceId,
  resourceName,
  resourceType,
  onClose,
}) => {
  const [tab, setTab] = useState<'public' | 'private'>('public');
  const [loading, setLoading] = useState(false);
  const [existingShares, setExistingShares] = useState<ShareData[]>([]);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Public share state
  const [publicPassword, setPublicPassword] = useState('');
  const [publicEnablePassword, setPublicEnablePassword] = useState(false);
  const [publicExpiryOption, setPublicExpiryOption] = useState<'never' | '1day' | '7days' | '30days'>('never');
  const [publicPermission, setPublicPermission] = useState<'view' | 'edit'>('view');

  // Private share state
  const [recipientEmailInput, setRecipientEmailInput] = useState('');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [privatePermission, setPrivatePermission] = useState<'view' | 'edit'>('view');

  // Fetch existing shares for this resource
  useEffect(() => {
    const fetchShares = async () => {
      try {
        const res = await fetch('/api/shares/manage', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const matches = (data.shares || []).filter((s: any) => s.resourceId === resourceId);
          setExistingShares(matches);
        }
      } catch (err) {
        console.error('Error fetching shares:', err);
      }
    };
    fetchShares();
  }, [resourceId]);

  const computeExpiresAt = (option: string): string | null => {
    if (option === 'never') return null;

    const now = new Date();
    if (option === '1day') now.setDate(now.getDate() + 1);
    if (option === '7days') now.setDate(now.getDate() + 7);
    if (option === '30days') now.setDate(now.getDate() + 30);
    return now.toISOString();
  };

  const handleCreatePublicShare = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const expiresAt = computeExpiresAt(publicExpiryOption);
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          resourceType,
          type: 'public',
          permission: publicPermission,
          password: publicEnablePassword && publicPassword.trim() ? publicPassword.trim() : undefined,
          expiresAt,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create public link');
      }

      setExistingShares((prev) => [data.share, ...prev]);
      setSuccessMessage('Public share link generated successfully!');
      setPublicPassword('');
      setPublicEnablePassword(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating public share');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipient = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter') return;
    if (e) e.preventDefault();

    const email = recipientEmailInput.trim().toLowerCase();
    if (email && email.includes('@') && !recipientEmails.includes(email)) {
      setRecipientEmails([...recipientEmails, email]);
      setRecipientEmailInput('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipientEmails(recipientEmails.filter((e) => e !== email));
  };

  const handleCreatePrivateShare = async () => {
    const allEmails = [...recipientEmails];
    const currentInput = recipientEmailInput.trim().toLowerCase();
    if (currentInput && currentInput.includes('@') && !allEmails.includes(currentInput)) {
      allEmails.push(currentInput);
    }

    if (allEmails.length === 0) {
      setErrorMessage('Please add at least one recipient email');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          resourceType,
          type: 'private',
          permission: privatePermission,
          recipientEmails: allEmails,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create private share');
      }

      setExistingShares((prev) => [data.share, ...prev]);
      setSuccessMessage('Shared with recipients successfully!');
      setRecipientEmails([]);
      setRecipientEmailInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating private share');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      const res = await fetch(`/api/shares/${shareId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setExistingShares(existingShares.filter((s) => s.id !== shareId));
        setSuccessMessage('Share revoked successfully');
      }
    } catch (err) {
      console.error('Error revoking share:', err);
    }
  };

  const copyToClipboard = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publicShares = existingShares.filter((s) => s.type === 'public');

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
          maxWidth: '560px',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#1F1F1F' }}>
              Share "{resourceName}"
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#5F6368' }}>
              {resourceType === 'folder' ? 'Folder' : 'File'} access permissions & links
            </p>
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

        {/* Feedback Alerts */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#FCE8E6',
              color: '#C5221F',
              fontSize: '0.85rem',
              marginBottom: '16px',
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#E6F4EA',
              color: '#137333',
              fontSize: '0.85rem',
              marginBottom: '16px',
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Tab Toggle */}
        <div style={{ display: 'flex', gap: '8px', background: '#F0F4F9', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setTab('public')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'public' ? '#FFFFFF' : 'transparent',
              color: tab === 'public' ? '#0B57D0' : '#5F6368',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: tab === 'public' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <Globe size={16} />
            <span>Public Link</span>
          </button>

          <button
            onClick={() => setTab('private')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'private' ? '#FFFFFF' : 'transparent',
              color: tab === 'private' ? '#0B57D0' : '#5F6368',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: tab === 'private' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <Users size={16} />
            <span>Direct Users</span>
          </button>
        </div>

        {/* Public Link Content */}
        {tab === 'public' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Existing Public Link */}
            {publicShares.length > 0 && (
              <div style={{ background: '#F8FAFD', border: '1px solid #E0E3E7', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Active Public Link
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${publicShares[0].publicUrl}`}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #E0E3E7',
                      background: '#FFFFFF',
                      fontSize: '0.85rem',
                      color: '#1F1F1F',
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(publicShares[0].publicUrl!)}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleRevokeShare(publicShares[0].id)}
                    style={{ background: 'none', border: 'none', color: '#C5221F', cursor: 'pointer', padding: '6px' }}
                    title="Revoke link"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Create / Reconfigure Link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '4px' }}>
                  Permission
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setPublicPermission('view')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${publicPermission === 'view' ? '#0B57D0' : '#E0E3E7'}`,
                      background: publicPermission === 'view' ? '#E8F0FE' : '#FFFFFF',
                      color: publicPermission === 'view' ? '#0B57D0' : '#5F6368',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View & Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublicPermission('edit')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${publicPermission === 'edit' ? '#0B57D0' : '#E0E3E7'}`,
                      background: publicPermission === 'edit' ? '#E8F0FE' : '#FFFFFF',
                      color: publicPermission === 'edit' ? '#0B57D0' : '#5F6368',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Can Edit (Office)
                  </button>
                </div>
              </div>

              {/* Password Option */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#1F1F1F', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={publicEnablePassword}
                    onChange={(e) => setPublicEnablePassword(e.target.checked)}
                  />
                  <span>Password Protect Link</span>
                </label>
                {publicEnablePassword && (
                  <input
                    type="password"
                    placeholder="Enter link password"
                    value={publicPassword}
                    onChange={(e) => setPublicPassword(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #747775',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                )}
              </div>

              {/* Expiry Option */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '4px' }}>
                  Expiration
                </label>
                <select
                  value={publicExpiryOption}
                  onChange={(e: any) => setPublicExpiryOption(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #747775',
                    fontSize: '0.85rem',
                    background: '#FFFFFF',
                    color: '#1F1F1F',
                  }}
                >
                  <option value="never">Never expires</option>
                  <option value="1day">1 Day</option>
                  <option value="7days">7 Days</option>
                  <option value="30days">30 Days</option>
                </select>
              </div>

              <button
                onClick={handleCreatePublicShare}
                disabled={loading}
                className="btn btn-primary"
                style={{ padding: '10px 20px', marginTop: '4px' }}
              >
                {loading ? <Loader2 size={16} className="spin" /> : 'Generate Public Link'}
              </button>
            </div>
          </div>
        ) : (
          /* Private Share Content */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '4px' }}>
                Add People
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={recipientEmailInput}
                  onChange={(e) => setRecipientEmailInput(e.target.value)}
                  onKeyDown={handleAddRecipient}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #747775',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddRecipient}
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px' }}
                >
                  <UserPlus size={16} />
                  <span>Add</span>
                </button>
              </div>

              {recipientEmails.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {recipientEmails.map((email) => (
                    <span
                      key={email}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        background: '#E8F0FE',
                        color: '#0B57D0',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                      }}
                    >
                      {email}
                      <button
                        onClick={() => handleRemoveRecipient(email)}
                        style={{ background: 'none', border: 'none', color: '#0B57D0', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Private Share Permission */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '4px' }}>
                Permission
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPrivatePermission('view')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: `1px solid ${privatePermission === 'view' ? '#0B57D0' : '#E0E3E7'}`,
                    background: privatePermission === 'view' ? '#E8F0FE' : '#FFFFFF',
                    color: privatePermission === 'view' ? '#0B57D0' : '#5F6368',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  View only
                </button>
                <button
                  type="button"
                  onClick={() => setPrivatePermission('edit')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: `1px solid ${privatePermission === 'edit' ? '#0B57D0' : '#E0E3E7'}`,
                    background: privatePermission === 'edit' ? '#E8F0FE' : '#FFFFFF',
                    color: privatePermission === 'edit' ? '#0B57D0' : '#5F6368',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Can Edit
                </button>
              </div>
            </div>

            <button
              onClick={handleCreatePrivateShare}
              disabled={loading || (recipientEmails.length === 0 && !recipientEmailInput.trim())}
              className="btn btn-primary"
              style={{ padding: '10px 20px', marginTop: '4px' }}
            >
              {loading ? <Loader2 size={16} className="spin" /> : 'Share with Users'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
