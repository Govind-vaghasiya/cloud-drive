import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Folder, 
  Eye, 
  Download, 
  Loader2, 
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Code,
  Archive,
  Layers
} from 'lucide-react';
import { FileItem, getFileIcon, isMediaFile } from './FileCard';
import { FilePreviewModal } from './FilePreviewModal';

interface SearchResultItem {
  id: string;
  type: 'file' | 'folder';
  name: string;
  mimeType?: string;
  size?: number;
  sizeFormatted?: string;
  thumbnailPath?: string | null;
  folderId?: string | null;
  folderName?: string;
  parentId?: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchResultsProps {
  initialQuery: string;
  onNavigateToFolder: (folderId: string | null) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  initialQuery,
  onNavigateToFolder,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [categoriesCount, setCategoriesCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<FileItem | null>(null);

  const performSearch = useCallback(async (searchQuery: string, cat: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const catParam = cat !== 'all' ? `&category=${cat}` : '';
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}${catParam}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setCategoriesCount(data.categoriesCount || {});
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
    performSearch(initialQuery, activeCategory);
  }, [initialQuery, activeCategory, performSearch]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    performSearch(query, cat);
  };

  const handlePreview = (item: SearchResultItem) => {
    if (item.type === 'file') {
      const fileItem: FileItem = {
        id: item.id,
        folderId: item.folderId || null,
        name: item.name,
        mimeType: item.mimeType || 'application/octet-stream',
        size: item.size || 0,
        sizeFormatted: item.sizeFormatted || '',
        thumbnailPath: item.thumbnailPath,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      setPreviewingFile(fileItem);
    }
  };

  const handleDownload = (item: SearchResultItem) => {
    if (item.type === 'file') {
      const a = document.createElement('a');
      a.href = `/api/files/${item.id}/download`;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const filterTabs = [
    { id: 'all', label: 'All Results', icon: Layers },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'code', label: 'Code', icon: Code },
    { id: 'archives', label: 'Archives', icon: Archive },
    { id: 'folders', label: 'Folders', icon: Folder },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Filter Tabs */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--accent-gradient)', padding: '10px', borderRadius: 'var(--radius-md)', display: 'flex' }}>
              <Search size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                Search Results for <span className="text-gradient">"{query}"</span>
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Found {categoriesCount.all || results.length} matching items
              </span>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const count = categoriesCount[tab.id] !== undefined ? categoriesCount[tab.id] : 0;
            const isActive = activeCategory === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleCategoryChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  background: isActive ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span
                  style={{
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="spin" />
        </div>
      ) : results.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '50%' }}>
            <Search size={40} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>No matching items found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '360px' }}>
            Try searching with a different keyword or checking your spelling.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {results.map((item) => {
            const isFile = item.type === 'file';
            const { isMedia } = isFile
              ? isMediaFile(item.mimeType || '', item.name)
              : { isMedia: false };

            return (
              <div
                key={item.id}
                className="glass-panel group"
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Header with thumbnail or icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {isFile ? (
                      isMedia ? (
                        <img
                          src={`/api/thumbnail/${item.id}`}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        getFileIcon(item.mimeType || '', item.name)
                      )
                    ) : (
                      <FolderOpen size={24} color="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      title={item.name}
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isFile ? item.sizeFormatted : 'Folder'}
                    </div>
                  </div>
                </div>

                {/* Location Path info */}
                <div
                  onClick={() => onNavigateToFolder(item.folderId || item.parentId || null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                  title="Click to jump to folder"
                >
                  <FolderOpen size={13} color="#3b82f6" />
                  <span>In: <strong style={{ color: 'var(--text-primary)' }}>{item.folderName || 'My Drive'}</strong></span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                  {isFile ? (
                    <>
                      <button
                        onClick={() => handlePreview(item)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={14} />
                        <span>Preview</span>
                      </button>
                      <button
                        onClick={() => handleDownload(item)}
                        className="btn btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onNavigateToFolder(item.id)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FolderOpen size={14} />
                      <span>Open Folder</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
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
