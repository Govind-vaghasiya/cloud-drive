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
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onOpen,
  onShare,
  onRename,
  onMove,
  onDelete,
  onToggleStar,
}) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

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
        onClick={() => onOpen(folder.id)}
        onContextMenu={handleContextMenu}
        className="folder-pill group"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#F0F4F9',
          border: '1px solid transparent',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          userSelect: 'none',
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
