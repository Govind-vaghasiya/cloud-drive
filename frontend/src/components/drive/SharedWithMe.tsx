import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Download, 
  Eye, 
  Loader2, 
  Folder as FolderIcon 
} from 'lucide-react';
import { FileItem, getFileIcon } from './FileCard';
import { FilePreviewModal } from './FilePreviewModal';

interface SharedItem {
  shareId: string;
  resourceId: string;
  resourceType: 'file' | 'folder';
  name: string;
  permission: 'view' | 'edit';
  expiresAt?: string | null;
  sharedAt: string;
  owner: {
    name: string;
    email: string;
  };
  fileDetails?: {
    size: number;
    sizeFormatted: string;
    mimeType: string;
    thumbnailPath?: string | null;
    createdAt: string;
  } | null;
}

export const SharedWithMe: React.FC = () => {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingFile, setPreviewingFile] = useState<FileItem | null>(null);

  const fetchSharedItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shares/shared-with-me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.sharedItems || []);
      }
    } catch (err) {
      console.error('Error fetching shared items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedItems();
  }, []);

  const handleDownload = (item: SharedItem) => {
    if (item.resourceType !== 'file') return;
    const a = document.createElement('a');
    a.href = `/api/files/${item.resourceId}/download`;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePreview = (item: SharedItem) => {
    if (item.resourceType !== 'file' || !item.fileDetails) return;
    setPreviewingFile({
      id: item.resourceId,
      folderId: null,
      name: item.name,
      mimeType: item.fileDetails.mimeType,
      size: item.fileDetails.size,
      sizeFormatted: item.fileDetails.sizeFormatted,
      thumbnailPath: item.fileDetails.thumbnailPath,
      createdAt: item.fileDetails.createdAt,
      updatedAt: item.fileDetails.createdAt,
    });
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
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
          Shared with me
        </h1>
      </div>

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
            <Users size={38} color="#0B57D0" strokeWidth={1.8} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Nothing shared yet
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#72777A', maxWidth: '320px', margin: 0 }}>
            Files and folders shared directly with your email will appear here.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid #E0E3E7', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 2fr) 140px 120px 140px 100px',
              padding: '10px 16px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#5F6368',
              borderBottom: '1px solid #E0E3E7',
              background: '#F8FAFD',
            }}
          >
            <span>Name</span>
            <span>Shared By</span>
            <span>Permission</span>
            <span>Shared Date</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {items.map((item) => (
            <div
              key={item.shareId}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 2fr) 140px 120px 140px 100px',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: '1px solid #F1F3F4',
                fontSize: '0.86rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {item.resourceType === 'folder' ? (
                  <FolderIcon size={18} color="#FBBC04" fill="#FBBC04" />
                ) : (
                  getFileIcon(item.fileDetails?.mimeType || '', item.name, 18, '#1A73E8')
                )}
                <span style={{ fontWeight: 500, color: '#1F1F1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
              </div>

              <div style={{ color: '#5F6368', fontSize: '0.82rem' }}>
                {item.owner.name}
              </div>

              <div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: item.permission === 'edit' ? '#E6F4EA' : '#E8F0FE',
                    color: item.permission === 'edit' ? '#137333' : '#1A73E8',
                  }}
                >
                  {item.permission.toUpperCase()}
                </span>
              </div>

              <div style={{ color: '#5F6368', fontSize: '0.82rem' }}>
                {new Date(item.sharedAt).toLocaleDateString()}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                {item.resourceType === 'file' && (
                  <>
                    <button
                      onClick={() => handlePreview(item)}
                      title="Preview"
                      style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px' }}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDownload(item)}
                      title="Download"
                      style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px' }}
                    >
                      <Download size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewingFile && (
        <FilePreviewModal
          file={previewingFile}
          onClose={() => setPreviewingFile(null)}
          onDownload={() => {
            const a = document.createElement('a');
            a.href = `/api/files/${previewingFile.id}/download`;
            a.download = previewingFile.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        />
      )}
    </div>
  );
};
