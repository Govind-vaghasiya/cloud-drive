import React, { useEffect, useRef } from 'react';
import { Eye, Download, Share2, Edit2, FolderInput, Trash2, Edit3, Star, History, FolderPlus, Upload, FolderUp, Copy } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'file' | 'folder' | 'workspace' | 'multi';
  onClose: () => void;
  onPreview?: () => void;
  onOpenOffice?: () => void;
  isOffice?: boolean;
  onStar?: () => void;
  isStarred?: boolean;
  onVersionHistory?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  onNewFolder?: () => void;
  onUploadFile?: () => void;
  onUploadFolder?: () => void;
  onMoveSelected?: () => void;
  onCopySelected?: () => void;
  onDeleteSelected?: () => void;
  onClearSelection?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  type,
  onClose,
  onPreview,
  onOpenOffice,
  isOffice,
  onStar,
  isStarred,
  onVersionHistory,
  onDownload,
  onShare,
  onRename,
  onMove,
  onDelete,
  onNewFolder,
  onUploadFile,
  onUploadFolder,
  onMoveSelected,
  onCopySelected,
  onDeleteSelected,
  onClearSelection,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust coordinates so menu does not overflow window edges
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      className="fade-in"
      style={{
        position: 'fixed',
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
        zIndex: 1400,
        minWidth: '200px',
        background: '#FFFFFF',
        border: '1px solid #E0E3E7',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.16)',
        padding: '6px 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {type === 'workspace' && (
        <>
          {onNewFolder && (
            <button onClick={() => { onNewFolder(); onClose(); }} style={menuItemStyle}>
              <FolderPlus size={16} color="#1A73E8" />
              <span>New folder</span>
            </button>
          )}

          <div style={{ height: '1px', background: '#E0E3E7', margin: '4px 0' }} />

          {onUploadFile && (
            <button onClick={() => { onUploadFile(); onClose(); }} style={menuItemStyle}>
              <Upload size={16} color="#5F6368" />
              <span>Upload file</span>
            </button>
          )}

          {onUploadFolder && (
            <button onClick={() => { onUploadFolder(); onClose(); }} style={menuItemStyle}>
              <FolderUp size={16} color="#5F6368" />
              <span>Upload folder</span>
            </button>
          )}
        </>
      )}

      {type === 'multi' && (
        <>
          {onMoveSelected && (
            <button onClick={() => { onMoveSelected(); onClose(); }} style={menuItemStyle}>
              <FolderInput size={16} color="#5F6368" />
              <span>Move selected</span>
            </button>
          )}

          {onCopySelected && (
            <button onClick={() => { onCopySelected(); onClose(); }} style={menuItemStyle}>
              <Copy size={16} color="#5F6368" />
              <span>Copy selected</span>
            </button>
          )}

          {onDeleteSelected && (
            <button onClick={() => { onDeleteSelected(); onClose(); }} style={{ ...menuItemStyle, color: '#C5221F' }}>
              <Trash2 size={16} color="#C5221F" />
              <span>Delete selected</span>
            </button>
          )}

          <div style={{ height: '1px', background: '#E0E3E7', margin: '4px 0' }} />

          {onClearSelection && (
            <button onClick={() => { onClearSelection(); onClose(); }} style={menuItemStyle}>
              <span>Clear selection</span>
            </button>
          )}
        </>
      )}

      {type === 'file' && isOffice && onOpenOffice && (
        <button onClick={() => { onOpenOffice(); onClose(); }} style={menuItemStyle}>
          <Edit3 size={16} color="#0B57D0" />
          <span>Edit in Office</span>
        </button>
      )}

      {type === 'file' && onPreview && (
        <button onClick={() => { onPreview(); onClose(); }} style={menuItemStyle}>
          <Eye size={16} color="#0B57D0" />
          <span>Preview</span>
        </button>
      )}

      {onStar && type !== 'multi' && (
        <button onClick={() => { onStar(); onClose(); }} style={menuItemStyle}>
          <Star size={16} fill={isStarred ? '#F9AB00' : 'none'} color="#F9AB00" />
          <span>{isStarred ? 'Remove from Starred' : 'Add to Starred'}</span>
        </button>
      )}

      {type === 'file' && onVersionHistory && (
        <button onClick={() => { onVersionHistory(); onClose(); }} style={menuItemStyle}>
          <History size={16} color="#5F6368" />
          <span>Version History</span>
        </button>
      )}

      {type === 'file' && onDownload && (
        <button onClick={() => { onDownload(); onClose(); }} style={menuItemStyle}>
          <Download size={16} color="#137333" />
          <span>Download</span>
        </button>
      )}

      {onShare && type !== 'multi' && (
        <button onClick={() => { onShare(); onClose(); }} style={menuItemStyle}>
          <Share2 size={16} color="#5F6368" />
          <span>Share</span>
        </button>
      )}

      {onRename && type !== 'multi' && (
        <button onClick={() => { onRename(); onClose(); }} style={menuItemStyle}>
          <Edit2 size={16} color="#5F6368" />
          <span>Rename</span>
        </button>
      )}

      {onMove && type !== 'multi' && (
        <button onClick={() => { onMove(); onClose(); }} style={menuItemStyle}>
          <FolderInput size={16} color="#5F6368" />
          <span>Move to...</span>
        </button>
      )}

      {onDelete && type !== 'multi' && (
        <>
          <div style={{ height: '1px', background: '#E0E3E7', margin: '4px 0' }} />
          <button onClick={() => { onDelete(); onClose(); }} style={{ ...menuItemStyle, color: '#C5221F' }}>
            <Trash2 size={16} color="#C5221F" />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#3C4043',
  padding: '8px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '0.86rem',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'background 0.12s ease',
};
