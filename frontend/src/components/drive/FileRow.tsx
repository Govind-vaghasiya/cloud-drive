import React, { useState } from 'react';
import { MoreVertical, Download, Eye, Share2, Edit3, Star, History, Users } from 'lucide-react';
import { FileItem, getFileIcon, getFileTypeLabel, getFileColor } from './FileCard';
import { ContextMenu } from './ContextMenu';
import { isOfficeDocument } from '../office/OfficeEditorModal';

interface FileRowProps {
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

export const FileRow: React.FC<FileRowProps> = ({
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
  const [isHovered, setIsHovered] = useState(false);

  const isOffice = isOfficeDocument(file.name, file.mimeType);

  const handleRowClick = () => {
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

  const fileColor = getFileColor(file.mimeType, file.name);
  const typeLabel = getFileTypeLabel(file.mimeType, file.name);

  return (
    <>
      <div
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 2.5fr) 140px 100px 130px 130px',
          alignItems: 'center',
          padding: '8px 16px',
          background: isHovered ? '#F0F4F9' : '#FFFFFF',
          borderBottom: '1px solid #F1F3F4',
          cursor: 'pointer',
          transition: 'background 0.12s ease',
          fontSize: '0.86rem',
        }}
      >
        {/* Name with icon, star & shared badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '1rem' }}>
          {onToggleStar && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStar(file); }}
              title={file.isStarred ? 'Unstar' : 'Star'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
            >
              <Star size={16} fill={file.isStarred ? '#F9AB00' : 'none'} color={file.isStarred ? '#F9AB00' : '#BDC1C6'} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {getFileIcon(file.mimeType, file.name, 18, fileColor)}
          </div>

          <span
            title={file.name}
            style={{
              fontWeight: 500,
              color: '#1F1F1F',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {file.name}
          </span>

          {file.isShared && (
            <span title="Shared" style={{ color: '#1A73E8', display: 'flex', flexShrink: 0 }}>
              <Users size={14} />
            </span>
          )}
        </div>

        {/* Type Column with signature colored pill */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: fileColor,
              background: `${fileColor}15`,
              padding: '2px 8px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            {typeLabel}
          </span>
        </div>

        {/* Size */}
        <div style={{ color: '#5F6368', fontSize: '0.82rem' }}>
          {file.sizeFormatted}
        </div>

        {/* Date */}
        <div style={{ color: '#5F6368', fontSize: '0.82rem' }}>
          {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>

        {/* Quick Actions on Row Right */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}
        >
          {isOffice && onOpenOffice && (
            <button
              onClick={() => onOpenOffice(file)}
              title="Edit in OnlyOffice"
              style={{ background: 'none', border: 'none', color: '#1A73E8', cursor: 'pointer', padding: '4px', display: 'flex' }}
            >
              <Edit3 size={15} />
            </button>
          )}
          {onVersionHistory && (
            <button
              onClick={() => onVersionHistory(file)}
              title="Version History"
              style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px', display: 'flex' }}
            >
              <History size={15} />
            </button>
          )}
          <button
            onClick={() => onShare(file)}
            title="Share"
            style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <Share2 size={15} />
          </button>
          <button
            onClick={() => onPreview(file)}
            title="Preview"
            style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => onDownload(file)}
            title="Download"
            style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <Download size={15} />
          </button>
          <button
            onClick={handleMoreClick}
            title="Actions"
            style={{ background: 'none', border: 'none', color: '#5F6368', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <MoreVertical size={15} />
          </button>
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
