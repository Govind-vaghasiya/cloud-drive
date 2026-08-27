import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Code, 
  Archive, 
  File, 
  MoreVertical,
  Play,
  Star,
  Users
} from 'lucide-react';
import { ContextMenu } from './ContextMenu';
import { isOfficeDocument } from '../office/OfficeEditorModal';

export interface FileItem {
  id: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  size: number;
  sizeFormatted: string;
  thumbnailPath?: string | null;
  isStarred?: boolean;
  isShared?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FileCardProps {
  file: FileItem;
  onPreview: (file: FileItem) => void;
  onOpenOffice?: (file: FileItem) => void;
  onToggleStar?: (file: FileItem) => void;
  onVersionHistory?: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

export function isMediaFile(mimeType: string, name: string): { isMedia: boolean; isVideo: boolean; isImage: boolean } {
  const isImage = (mimeType && mimeType.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(name);
  const isVideo = (mimeType && mimeType.startsWith('video/')) || /\.(mp4|webm|mkv|mov|avi|m4v)$/i.test(name);
  return { isMedia: isImage || isVideo, isVideo, isImage };
}

export function getFileBannerClass(mimeType: string, name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) return 'file-banner-pdf';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || mime.includes('word') || mime.includes('document')) return 'file-banner-doc';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel')) return 'file-banner-sheet';
  if (['ppt', 'pptx', 'odp'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'file-banner-slide';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'file-banner-pdf';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'file-banner-media';
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'sh', 'sql', 'cpp', 'java'].includes(ext) || mime.startsWith('text/')) return 'file-banner-generic';
  return 'file-banner-generic';
}

export function getFileColor(mimeType: string, name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || mime.includes('word') || mime.includes('document')) return '#4285F4';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel')) return '#0F9D58';
  if (['ppt', 'pptx', 'odp'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return '#F4B400';
  if (ext === 'pdf' || mime.includes('pdf')) return '#EA4335';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) return '#EA4335';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return '#9C27B0';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return '#E91E63';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) return '#673AB7';
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'sh', 'sql', 'cpp', 'java'].includes(ext)) return '#00897B';
  return '#5F6368';
}

export function getFileTypeLabel(mimeType: string, name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (['doc', 'docx', 'odt'].includes(ext)) return 'Word Document';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'Spreadsheet';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'Presentation';
  if (ext === 'pdf' || mime.includes('pdf')) return 'PDF Document';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return `${ext.toUpperCase() || 'Image'} Image`;
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) return `${ext.toUpperCase() || 'Video'} Video`;
  if (mime.startsWith('audio/')) return `${ext.toUpperCase() || 'Audio'} Audio`;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'ZIP Archive';
  if (['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'py', 'sh', 'sql'].includes(ext)) return `${ext.toUpperCase()} Code`;
  return ext ? `${ext.toUpperCase()} File` : 'File';
}

export function getFileIcon(mimeType: string, name: string, size = 20, color?: string) {
  const iconColor = color || getFileColor(mimeType, name);
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return <ImageIcon size={size} color={iconColor} />;
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
    return <Film size={size} color={iconColor} />;
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return <Music size={size} color={iconColor} />;
  }
  if (['doc', 'docx', 'txt', 'md', 'rtf', 'pdf'].includes(ext) || mime.includes('pdf') || mime.includes('document')) {
    return <FileText size={size} color={iconColor} />;
  }
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'sh', 'sql', 'cpp', 'java'].includes(ext)) {
    return <Code size={size} color={iconColor} />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return <Archive size={size} color={iconColor} />;
  }
  return <File size={size} color={iconColor} />;
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  onPreview,
  onOpenOffice,
  onToggleStar,
  onVersionHistory,
  onDownload,
  onShare,
  onRename,
  onMove,
  onDelete,
}) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);

  const isOffice = isOfficeDocument(file.name, file.mimeType);
  const { isMedia, isVideo } = isMediaFile(file.mimeType, file.name);
  const hasThumbnail = (isMedia || Boolean(file.thumbnailPath)) && !thumbnailError;
  const thumbnailUrl = `/api/thumbnail/${file.id}`;
  const bannerClass = getFileBannerClass(file.mimeType, file.name);

  const handleCardClick = () => {
    onPreview(file);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenuPos({ x: rect.right, y: rect.bottom });
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        className="file-card-gdrive group"
        style={{
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#FFFFFF',
          border: '1px solid #E0E3E7',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Top Preview Banner (Visual color gradient or real thumbnail) */}
        <div
          className={`file-preview-banner ${bannerClass}`}
          style={{
            height: '110px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hasThumbnail ? (
            <>
              <img
                src={thumbnailUrl}
                alt={file.name}
                loading="lazy"
                onLoad={() => setThumbnailLoaded(true)}
                onError={() => setThumbnailError(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: thumbnailLoaded ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}
              />
              {!thumbnailLoaded && getFileIcon(file.mimeType, file.name, 36, '#FFFFFF')}
              {isVideo && thumbnailLoaded && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <Play size={20} fill="#ffffff" color="#ffffff" />
                </div>
              )}
            </>
          ) : (
            getFileIcon(file.mimeType, file.name, 36, '#FFFFFF')
          )}

          {/* Star & Shared Badges */}
          <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
            {file.isStarred && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  padding: '4px',
                  borderRadius: '50%',
                  display: 'flex',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <Star size={12} fill="#F9AB00" color="#F9AB00" />
              </div>
            )}
            {file.isShared && (
              <div
                title="Shared"
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  padding: '4px',
                  borderRadius: '50%',
                  display: 'flex',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  color: '#1A73E8',
                }}
              >
                <Users size={12} />
              </div>
            )}
          </div>

          {/* Top-right More Action icon on hover */}
          <button
            onClick={handleMoreClick}
            title="More actions"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(255, 255, 255, 0.85)',
              border: 'none',
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#3C4043',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}
          >
            <MoreVertical size={15} />
          </button>
        </div>

        {/* Bottom Metadata Section (Name only) */}
        <div style={{ padding: '12px', display: 'flex', alignItems: 'center', background: '#FFFFFF' }}>
          <div
            title={file.name}
            style={{
              fontSize: '0.86rem',
              fontWeight: 600,
              color: '#1F1F1F',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {file.name}
          </div>
        </div>
      </div>

      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          type="file"
          isOffice={isOffice}
          onOpenOffice={onOpenOffice ? () => onOpenOffice(file) : undefined}
          onStar={onToggleStar ? () => onToggleStar(file) : undefined}
          isStarred={file.isStarred}
          onVersionHistory={onVersionHistory ? () => onVersionHistory(file) : undefined}
          onClose={() => setContextMenuPos(null)}
          onPreview={() => onPreview(file)}
          onDownload={() => onDownload(file)}
          onShare={() => onShare(file)}
          onRename={() => onRename(file)}
          onMove={() => onMove(file)}
          onDelete={() => onDelete(file)}
        />
      )}
    </>
  );
};
