import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Globe, 
  Users, 
  Trash2, 
  Copy, 
  Check, 
  Lock, 
  ExternalLink, 
  Loader2,
  Folder as FolderIcon
} from 'lucide-react';
import { getFileIcon, getFileColor } from './FileCard';

interface ManagedShare {
  id: string;
  token?: string | null;
  publicUrl?: string | null;
  resourceId: string;
  resourceType: 'file' | 'folder';
  name: string;
  type: 'public' | 'private';
  hasPassword: boolean;
  expiresAt?: string | null;
  isExpired: boolean;
  permission: 'view' | 'edit';
  createdAt: string;
  fileDetails?: {
    size: number;
    sizeFormatted: string;
    mimeType: string;
    thumbnailPath?: string | null;
  } | null;
  recipients: Array<{ id: string; name: string; email: string }>;
}

export const ManageShares: React.FC = () => {
  const [shares, setShares] = useState<ManagedShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shares/manage', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
      }
    } catch (err) {
      console.error('Error fetching manage shares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleRevoke = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share? Anyone with this link will immediately lose access.')) {
      return;
    }

    try {
      const res = await fetch(`/api/shares/${shareId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setShares(shares.filter((s) => s.id !== shareId));
      }
    } catch (err) {
      console.error('Error revoking share:', err);
    }
  };

  const copyPublicLink = (shareId: string, url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredShares = shares.filter((s) => {
    if (filter === 'public' && s.type !== 'public') return false;
    if (filter === 'private' && s.type !== 'private') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchRecipients = s.recipients?.some((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
      if (!matchName && !matchRecipients) return false;
    }
    return true;
  });

  const publicCount = shares.filter((s) => s.type === 'public').length;
  const privateCount = shares.filter((s) => s.type === 'private').length;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Manage Shares
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#72777A' }}>
            View and manage active public share links and direct user permissions
          </p>
        </div>

        {/* Controls: Search Bar & Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filter shares..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid #E0E3E7',
              fontSize: '0.85rem',
              outline: 'none',
              background: '#F8FAFD',
              width: '200px',
            }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setFilter('all')}
              className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            >
              All ({shares.length})
            </button>
            <button
              onClick={() => setFilter('public')}
              className={`filter-chip ${filter === 'public' ? 'active' : ''}`}
            >
              Public ({publicCount})
            </button>
            <button
              onClick={() => setFilter('private')}
              className={`filter-chip ${filter === 'private' ? 'active' : ''}`}
            >
              Private ({privateCount})
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Loader2 size={36} className="spin" color="#0B57D0" />
        </div>
      ) : filteredShares.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '12px',
            padding: '4rem 1rem',
          }}
        >
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '24px',
              background: '#F0F4F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={38} color="#0B57D0" strokeWidth={1.8} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            No matching shares
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#72777A', maxWidth: '320px', margin: 0 }}>
            {searchQuery ? 'No shares match your search query.' : 'When you create public links or share files, they will appear in this table.'}
          </p>
        </div>
      ) : (
        /* Structured Table Layout */
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E0E3E7',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFD', borderBottom: '1px solid #E0E3E7', color: '#5F6368', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 16px' }}>Shared Resource</th>
                <th style={{ padding: '12px 16px' }}>Share Type</th>
                <th style={{ padding: '12px 16px' }}>Recipients / Access</th>
                <th style={{ padding: '12px 16px' }}>Permission</th>
                <th style={{ padding: '12px 16px' }}>Created / Expires</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShares.map((share) => (
                <tr
                  key={share.id}
                  style={{
                    borderBottom: '1px solid #F1F3F4',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Resource Name & Icon */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#F0F4F9', padding: '8px', borderRadius: '8px', display: 'flex', flexShrink: 0 }}>
                        {share.resourceType === 'folder' ? (
                          <FolderIcon size={20} color="#FBBC04" fill="#FBBC04" />
                        ) : (
                          getFileIcon(share.fileDetails?.mimeType || '', share.name, 20, getFileColor(share.fileDetails?.mimeType || '', share.name))
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#1F1F1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }} title={share.name}>
                          {share.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#72777A' }}>
                          {share.resourceType.toUpperCase()} {share.fileDetails?.sizeFormatted ? `· ${share.fileDetails.sizeFormatted}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Share Type */}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        background: share.type === 'public' ? '#E8F0FE' : '#E6F4EA',
                        color: share.type === 'public' ? '#0B57D0' : '#137333',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      {share.type === 'public' ? <Globe size={12} /> : <Users size={12} />}
                      <span>{share.type === 'public' ? 'Public Link' : 'Direct Share'}</span>
                    </span>
                  </td>

                  {/* Recipients / Password */}
                  <td style={{ padding: '12px 16px', color: '#3C4043' }}>
                    {share.type === 'public' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#5F6368' }}>Anyone with link</span>
                        {share.hasPassword && (
                          <span style={{ background: '#FEF7E0', color: '#B06000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Lock size={10} /> Protected
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#1F1F1F' }}>
                        {share.recipients && share.recipients.length > 0 ? (
                          <span>{share.recipients.map((r) => r.email).join(', ')}</span>
                        ) : (
                          <span style={{ color: '#9AA0A6' }}>No recipients</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Permission */}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: share.permission === 'edit' ? '#E8F0FE' : '#F1F3F4',
                        color: share.permission === 'edit' ? '#0B57D0' : '#5F6368',
                      }}
                    >
                      {share.permission === 'edit' ? 'Can Edit' : 'View Only'}
                    </span>
                  </td>

                  {/* Dates */}
                  <td style={{ padding: '12px 16px', color: '#5F6368', fontSize: '0.78rem' }}>
                    <div>Created: {new Date(share.createdAt).toLocaleDateString()}</div>
                    {share.expiresAt && (
                      <div style={{ color: share.isExpired ? '#C5221F' : '#72777A', fontWeight: share.isExpired ? 600 : 400 }}>
                        Expires: {new Date(share.expiresAt).toLocaleDateString()} {share.isExpired ? '(Expired)' : ''}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      {share.type === 'public' && share.publicUrl && (
                        <>
                          <button
                            onClick={() => copyPublicLink(share.id, share.publicUrl!)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Copy share link"
                          >
                            {copiedId === share.id ? <Check size={13} /> : <Copy size={13} />}
                            <span>{copiedId === share.id ? 'Copied' : 'Copy Link'}</span>
                          </button>
                          <a
                            href={share.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '0.78rem', display: 'flex' }}
                            title="Open link in new tab"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </>
                      )}

                      <button
                        onClick={() => handleRevoke(share.id)}
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '0.78rem', color: '#C5221F', borderColor: '#FAD2CF' }}
                        title="Revoke share"
                      >
                        <Trash2 size={13} />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
