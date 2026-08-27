import React, { useState, useEffect, useCallback } from 'react';
import { 
  Folder as FolderIcon, 
  Loader2 
} from 'lucide-react';
import { FileCard, FileItem } from './FileCard';
import { FileRow } from './FileRow';
import { FolderCard, FolderItem } from './FolderCard';
import { OfficeEditorModal } from '../office/OfficeEditorModal';
import { FilePreviewModal } from './FilePreviewModal';
import { ShareModal } from './ShareModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { FileTypeFilter, ModifiedFilter } from '../layout/Header';

interface StarredScreenProps {
  searchQuery?: string;
  typeFilter?: FileTypeFilter;
  modifiedFilter?: ModifiedFilter;
  viewMode?: 'grid' | 'list';
}

export const StarredScreen: React.FC<StarredScreenProps> = ({
  searchQuery = '',
  typeFilter = 'all',
  modifiedFilter = 'anytime',
  viewMode = 'grid',
}) => {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [previewingFile, setPreviewingFile] = useState<FileItem | null>(null);
  const [editingOfficeFile, setEditingOfficeFile] = useState<FileItem | null>(null);
  const [versionHistoryFile, setVersionHistoryFile] = useState<FileItem | null>(null);
  const [sharingItem, setSharingItem] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

  const fetchStarredItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/favorites', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load favorites');
      const data = await res.json();
      setFolders((data.folders || []).map((f: any) => ({ ...f, isStarred: true })));
      setFiles((data.files || []).map((f: any) => ({ ...f, isStarred: true })));
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStarredItems();
  }, [fetchStarredItems]);

  const handleToggleStar = async (resource: FileItem | FolderItem, type: 'file' | 'folder') => {
    try {
      await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, resourceType: type }),
        credentials: 'include',
      });
      fetchStarredItems();
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  const handleDownload = (file: FileItem) => {
    const a = document.createElement('a');
    a.href = `/api/files/${file.id}/download`;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredFolders = folders.filter((f) => {
    if (typeFilter !== 'all' && typeFilter !== 'folders') return false;
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredFiles = files.filter((file) => {
    if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (modifiedFilter !== 'anytime') {
      const fileDate = new Date(file.createdAt).getTime();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      if (modifiedFilter === 'today' && now - fileDate > dayMs) return false;
      if (modifiedFilter === '7days' && now - fileDate > 7 * dayMs) return false;
      if (modifiedFilter === '30days' && now - fileDate > 30 * dayMs) return false;
      if (modifiedFilter === 'year' && new Date(file.createdAt).getFullYear() !== new Date().getFullYear()) return false;
    }
    return true;
  });

  const isEmpty = filteredFolders.length === 0 && filteredFiles.length === 0;

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
      {/* Top Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
          Starred
        </h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Loader2 size={36} className="spin" color="#1A73E8" />
        </div>
      ) : isEmpty ? (
        /* Empty State matching Screenshot 1 */
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
            <FolderIcon size={38} color="#0B57D0" strokeWidth={1.8} />
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Empty folder
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#72777A', maxWidth: '320px', margin: 0 }}>
            Drop files here or click <strong>+ New</strong> above to upload items to this folder.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Starred Folders */}
          {filteredFolders.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#5F6368', textTransform: 'uppercase', marginBottom: '12px' }}>
                Folders
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '12px',
                }}
              >
                {filteredFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={() => {}}
                    onShare={(f) => setSharingItem({ id: f.id, name: f.name, type: 'folder' })}
                    onRename={() => {}}
                    onMove={() => {}}
                    onDelete={() => {}}
                    onToggleStar={(f) => handleToggleStar(f, 'folder')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Starred Files */}
          {filteredFiles.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#5F6368', textTransform: 'uppercase', marginBottom: '12px' }}>
                Files
              </div>

              {viewMode === 'grid' ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '14px',
                  }}
                >
                  {filteredFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onPreview={(f) => setPreviewingFile(f)}
                      onOpenOffice={(f) => setEditingOfficeFile(f)}
                      onToggleStar={(f) => handleToggleStar(f, 'file')}
                      onVersionHistory={(f) => setVersionHistoryFile(f)}
                      onDownload={(f) => handleDownload(f)}
                      onShare={(f) => setSharingItem({ id: f.id, name: f.name, type: 'file' })}
                      onRename={() => {}}
                      onMove={() => {}}
                      onDelete={() => {}}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ border: '1px solid #E0E3E7', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 2.5fr) 140px 100px 130px 130px',
                      padding: '10px 16px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#5F6368',
                      borderBottom: '1px solid #E0E3E7',
                      background: '#F8FAFD',
                    }}
                  >
                    <span>Name</span>
                    <span>Type</span>
                    <span>Size</span>
                    <span>Modified</span>
                    <span style={{ textAlign: 'right' }}>Actions</span>
                  </div>

                  {filteredFiles.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      onPreview={(f) => setPreviewingFile(f)}
                      onOpenOffice={(f) => setEditingOfficeFile(f)}
                      onToggleStar={(f) => handleToggleStar(f, 'file')}
                      onVersionHistory={(f) => setVersionHistoryFile(f)}
                      onDownload={(f) => handleDownload(f)}
                      onShare={(f) => setSharingItem({ id: f.id, name: f.name, type: 'file' })}
                      onRename={() => {}}
                      onMove={() => {}}
                      onDelete={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {previewingFile && (
        <FilePreviewModal
          file={previewingFile}
          onClose={() => setPreviewingFile(null)}
          onOpenOffice={() => setEditingOfficeFile(previewingFile)}
          onDownload={() => handleDownload(previewingFile)}
        />
      )}

      {editingOfficeFile && (
        <OfficeEditorModal
          file={editingOfficeFile}
          onClose={() => setEditingOfficeFile(null)}
          onSaved={fetchStarredItems}
          onSwitchToPreview={() => {
            setPreviewingFile(editingOfficeFile);
            setEditingOfficeFile(null);
          }}
        />
      )}

      {versionHistoryFile && (
        <VersionHistoryModal
          fileId={versionHistoryFile.id}
          fileName={versionHistoryFile.name}
          onClose={() => setVersionHistoryFile(null)}
          onRestored={fetchStarredItems}
        />
      )}

      {sharingItem && (
        <ShareModal
          resourceId={sharingItem.id}
          resourceName={sharingItem.name}
          resourceType={sharingItem.type}
          onClose={() => setSharingItem(null)}
        />
      )}
    </div>
  );
};
