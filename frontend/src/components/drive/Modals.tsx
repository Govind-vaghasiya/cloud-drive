import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Edit2, FolderInput, Trash2, AlertCircle, Loader2, Folder, HardDrive } from 'lucide-react';

// =============================================================================
// 1. New Folder Modal
// =============================================================================
interface NewFolderModalProps {
  currentFolderId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({ currentFolderId, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          parentId: currentFolderId === 'root' ? null : currentFolderId,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create folder');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error creating folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalContainer onClose={onClose} title="New Folder" icon={<FolderPlus size={22} color="#3b82f6" />}>
      {error && <ErrorAlert message={error} />}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
            Folder Name
          </label>
          <input
            type="text"
            autoFocus
            required
            placeholder="e.g. Documents, Projects, Photos"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button type="submit" disabled={loading || !name.trim()} style={primaryBtnStyle}>
            {loading ? <Loader2 size={16} className="spin" /> : 'Create Folder'}
          </button>
        </div>
      </form>
    </ModalContainer>
  );
};

// =============================================================================
// 2. Rename Modal (File or Folder)
// =============================================================================
interface RenameModalProps {
  item: { id: string; name: string; type: 'file' | 'folder' };
  onClose: () => void;
  onSuccess: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({ item, onClose, onSuccess }) => {
  const [name, setName] = useState(item.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const endpoint = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to rename ${item.type}`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error renaming item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalContainer onClose={onClose} title={`Rename ${item.type === 'folder' ? 'Folder' : 'File'}`} icon={<Edit2 size={22} color="#8b5cf6" />}>
      {error && <ErrorAlert message={error} />}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
            New Name
          </label>
          <input
            type="text"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button type="submit" disabled={loading || !name.trim()} style={primaryBtnStyle}>
            {loading ? <Loader2 size={16} className="spin" /> : 'Save'}
          </button>
        </div>
      </form>
    </ModalContainer>
  );
};

// =============================================================================
// 3. Move Modal (File or Folder)
// =============================================================================
interface MoveModalProps {
  item: { id: string; name: string; type: 'file' | 'folder' };
  onClose: () => void;
  onSuccess: () => void;
}

export const MoveModal: React.FC<MoveModalProps> = ({ item, onClose, onSuccess }) => {
  const [folders, setFolders] = useState<Array<{ id: string; name: string; parent_id: string | null }>>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllFolders = async () => {
      try {
        const res = await fetch('/api/folders', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          // Filter out the folder itself to prevent cyclic move
          const valid = (data.folders || []).filter((f: any) => f.id !== item.id);
          setFolders(valid);
        }
      } catch {
        setError('Failed to load folders');
      } finally {
        setLoading(false);
      }
    };
    fetchAllFolders();
  }, [item.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const endpoint = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      const payload = item.type === 'folder' 
        ? { parentId: selectedFolderId === 'root' ? null : selectedFolderId }
        : { folderId: selectedFolderId === 'root' ? null : selectedFolderId };

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to move ${item.type}`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error moving item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalContainer onClose={onClose} title={`Move "${item.name}"`} icon={<FolderInput size={22} color="#3b82f6" />}>
      {error && <ErrorAlert message={error} />}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Select destination folder:</p>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '8px' }}>
            <Loader2 size={18} className="spin" />
            <span>Loading destinations...</span>
          </div>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setSelectedFolderId('root')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: selectedFolderId === 'root' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                border: selectedFolderId === 'root' ? '1px solid #3b82f6' : '1px solid transparent',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <HardDrive size={16} color="#3b82f6" />
              <span>My Drive (Root)</span>
            </button>

            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFolderId(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: selectedFolderId === f.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                  border: selectedFolderId === f.id ? '1px solid #3b82f6' : '1px solid transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Folder size={16} color="#f59e0b" />
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button type="submit" disabled={submitting} style={primaryBtnStyle}>
            {submitting ? <Loader2 size={16} className="spin" /> : 'Move Here'}
          </button>
        </div>
      </form>
    </ModalContainer>
  );
};

// =============================================================================
// 4. Delete Confirmation Modal
// =============================================================================
interface DeleteConfirmModalProps {
  item: { id: string; name: string; type: 'file' | 'folder' };
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ item, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    setLoading(true);

    try {
      const endpoint = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to delete ${item.type}`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error deleting item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalContainer onClose={onClose} title={`Delete ${item.type === 'folder' ? 'Folder' : 'File'}`} icon={<Trash2 size={22} color="#ef4444" />}>
      {error && <ErrorAlert message={error} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Are you sure you want to delete <strong>"{item.name}"</strong>?
          {item.type === 'folder' && ' All files and subfolders inside will also be permanently deleted.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            style={{ ...primaryBtnStyle, background: 'rgba(239, 68, 68, 0.85)' }}
          >
            {loading ? <Loader2 size={16} className="spin" /> : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </ModalContainer>
  );
};

// =============================================================================
// Helper Layout Components & Styles
// =============================================================================
const ModalContainer: React.FC<{
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ onClose, title, icon, children }) => (
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
  >
    <div
      className="fade-in"
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E0E3E7',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
        width: '100%',
        maxWidth: '480px',
        padding: '24px',
        position: 'relative',
        color: '#1F1F1F',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#F0F4F9', padding: '10px', borderRadius: '12px', display: 'flex' }}>
          {icon}
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>{title}</h3>
      </div>

      {children}
    </div>
  </div>
);

const ErrorAlert: React.FC<{ message: string }> = ({ message }) => (
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
    <AlertCircle size={18} />
    <span>{message}</span>
  </div>
);

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

const primaryBtnStyle: React.CSSProperties = {
  background: '#0B57D0',
  border: 'none',
  color: '#FFFFFF',
  padding: '10px 20px',
  borderRadius: '20px',
  fontWeight: 600,
  fontSize: '0.88rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const secondaryBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #747775',
  color: '#0B57D0',
  padding: '10px 20px',
  borderRadius: '20px',
  fontWeight: 600,
  fontSize: '0.88rem',
  cursor: 'pointer',
};
