import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Folder, 
  Loader2, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { getFileIcon } from './FileCard';

interface TrashItem {
  id: string;
  type: 'file' | 'folder';
  name: string;
  mimeType?: string;
  size?: number;
  sizeFormatted?: string;
  deletedAt: string;
  expiresAt: string;
  daysRemaining: number;
}

export const TrashScreen: React.FC = () => {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<TrashItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trash', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.trashItems || []);
      }
    } catch (err) {
      console.error('Error fetching trash:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (item: TrashItem) => {
    setActionLoadingId(item.id);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: item.id, resourceType: item.type }),
        credentials: 'include',
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: `Restored "${item.name}"` });
        fetchTrash();
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to restore item' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    setActionLoadingId(item.id);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/trash/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: item.id, resourceType: item.type }),
        credentials: 'include',
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: `Permanently deleted "${item.name}"` });
        setPermanentDeleteId(null);
        fetchTrash();
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to permanently delete' });
    } finally {
      setActionLoadingId(null);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Trash
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#72777A' }}>
            Items in trash will be automatically deleted forever after 30 days.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            marginBottom: '12px',
            fontSize: '0.85rem',
            background: feedbackMsg.type === 'success' ? '#E6F4EA' : '#FCE8E6',
            color: feedbackMsg.type === 'success' ? '#137333' : '#C5221F',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {feedbackMsg.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Loader2 size={36} className="spin" color="#1A73E8" />
        </div>
      ) : items.length === 0 ? (
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
            <Trash2 size={38} color="#0B57D0" strokeWidth={1.8} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Trash is empty
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#72777A', maxWidth: '320px', margin: 0 }}>
            Deleted files and folders will appear here until permanently purged.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid #E0E3E7', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 2fr) 140px 140px 140px',
              padding: '10px 16px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#5F6368',
              borderBottom: '1px solid #E0E3E7',
              background: '#F8FAFD',
            }}
          >
            <span>Name</span>
            <span>Deleted Date</span>
            <span>Time Left</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 2fr) 140px 140px 140px',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: '1px solid #F1F3F4',
                fontSize: '0.86rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {item.type === 'folder' ? (
                  <Folder size={18} color="#FBBC04" fill="#FBBC04" />
                ) : (
                  getFileIcon(item.mimeType || '', item.name, 18, '#1A73E8')
                )}
                <span style={{ fontWeight: 500, color: '#1F1F1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
              </div>

              <div style={{ color: '#5F6368', fontSize: '0.82rem' }}>
                {new Date(item.deletedAt).toLocaleDateString()}
              </div>

              <div style={{ color: '#5F6368', fontSize: '0.82rem' }}>
                {item.daysRemaining} days left
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => handleRestore(item)}
                  disabled={actionLoadingId === item.id}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  <RotateCcw size={13} />
                  <span>Restore</span>
                </button>
                <button
                  onClick={() => setPermanentDeleteId(item)}
                  disabled={actionLoadingId === item.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#C5221F',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                  }}
                  title="Delete forever"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {permanentDeleteId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1F1F1F', margin: '0 0 8px 0' }}>
              Delete forever?
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#5F6368', margin: '0 0 20px 0' }}>
              "{permanentDeleteId.name}" will be deleted forever and you won't be able to restore it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setPermanentDeleteId(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePermanentDelete(permanentDeleteId)}
                className="btn btn-primary"
                style={{ background: '#C5221F' }}
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
