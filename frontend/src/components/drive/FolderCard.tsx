import React, { useState } from 'react';
import { Folder, MoreVertical, Star, Users } from 'lucide-react';
import { ContextMenu } from './ContextMenu';

export interface FolderItem {
  id: string;
  name: string;
  created_at?: string;
  createdAt?: string;
  isStarred?: boolean;
  isShared?: boolean;
}

interface FolderCardProps {
  folder: FolderItem;
  onOpen: (folderId: string) => void;
  onShare: (folder: FolderItem) => void;
  onRename: (folder: FolderItem) => void;
  onMove: (folder: FolderItem) => void;
  onDelete: (folder: FolderItem) => void;
  onToggleStar?: (folder: FolderItem) => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent, item: { id: string; name: string; type: 'file' | 'folder' }) => void;
  onDragStartItem?: (e: React.DragEvent, item: { id: string; name: string; type: 'file' | 'folder' }) => void;
  onDropOnFolder?: (targetFolderId: string, items: { id: string; name: string; type: 'file' | 'folder' }[]) => void;
  onRightClickStart?: (item: { id: string; name: string; type: 'file' | 'folder' }) => void;
  onHoverSelect?: (item: { id: string; name: string; type: 'file' | 'folder' }) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onOpen,
  onShare,
  onRename,
  onMove,
  onDelete,
  onToggleStar,
  isSelected = false,
  onSelect,
  onDragStartItem,
  onDropOnFolder,
  onRightClickStart,
  onHoverSelect,
}) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSelected && onSelect) {
      onSelect(e, { id: folder.id, name: folder.name, type: 'folder' });
    }
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenuPos({ x: rect.right, y: rect.bottom });
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStartItem) {
      onDragStartItem(e, { id: folder.id, name: folder.name, type: 'folder' });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-clouddrive-items')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (!isDragOverTarget) {
        setIsDragOverTarget(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOverTarget(false);
    if (e.dataTransfer.types.includes('application/x-clouddrive-items')) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const rawData = e.dataTransfer.getData('application/x-clouddrive-items');
        if (rawData) {
          const items = JSON.parse(rawData);
          if (Array.isArray(items) && onDropOnFolder) {
            onDropOnFolder(folder.id, items);
          }
        }
      } catch (err) {
        console.error('Failed to parse dropped items:', err);
      }
    }
  };

  return (
    <>
      <div
        draggable
        data-item-id={folder.id}
        data-item-type="folder"
        onClick={(e) => {
          if (onSelect) {
            onSelect(e, { id: folder.id, name: folder.name, type: 'folder' });
          } else {
            onOpen(folder.id);
          }
        }}
        onDoubleClick={() => onOpen(folder.id)}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseDown={(e) => {
          if (e.button === 2 && onRightClickStart) {
            onRightClickStart({ id: folder.id, name: folder.name, type: 'folder' });
          }
        }}
        onMouseEnter={() => {
          if (onHoverSelect) {
            onHoverSelect({ id: folder.id, name: folder.name, type: 'folder' });
          }
        }}
        className={`folder-pill group ${isSelected ? 'selected' : ''} ${isDragOverTarget ? 'drop-target-active' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: isDragOverTarget ? '#E8F0FE' : isSelected ? '#E8F0FE' : '#F0F4F9',
          border: isDragOverTarget ? '2px dashed #1A73E8' : isSelected ? '1px solid #1A73E8' : '1px solid transparent',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          boxShadow: isDragOverTarget ? '0 0 0 2px rgba(26,115,232,0.2)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <Folder size={20} color="#F9AB00" fill="#FBBC04" style={{ flexShrink: 0 }} />
          <span
            title={folder.name}
            style={{
              fontSize: '0.88rem',
              fontWeight: 500,
              color: '#1F1F1F',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {folder.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {folder.isShared && (
            <div title="Shared Folder" style={{ color: '#1A73E8', padding: '4px', display: 'flex' }}>
              <Users size={14} />
            </div>
          )}

          {onToggleStar && folder.isStarred && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStar(folder); }}
              title="Starred"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
            >
              <Star size={15} fill="#F9AB00" color="#F9AB00" />
            </button>
          )}

          <button
            onClick={handleMoreClick}
            title="Folder actions"
            style={{
              background: 'none',
              border: 'none',
              color: '#5F6368',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '50%',
              display: 'flex',
            }}
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          type="folder"
          onClose={() => setContextMenuPos(null)}
          onShare={() => onShare(folder)}
          onRename={() => onRename(folder)}
          onMove={() => onMove(folder)}
          onDelete={() => onDelete(folder)}
          onStar={onToggleStar ? () => onToggleStar(folder) : undefined}
          isStarred={folder.isStarred}
        />
      )}
    </>
  );
};
