import React from 'react';
import { X, FolderInput, Copy, Trash2 } from 'lucide-react';

interface SelectionMarqueeProps {
  box: { startX: number; startY: number; currentX: number; currentY: number } | null;
}

export const SelectionMarquee: React.FC<SelectionMarqueeProps> = ({ box }) => {
  if (!box) return null;

  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const width = Math.abs(box.startX - box.currentX);
  const height = Math.abs(box.startY - box.currentY);

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width,
        height,
        backgroundColor: 'rgba(26, 115, 232, 0.2)',
        border: '1px solid rgba(26, 115, 232, 0.8)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
};

interface SelectionToolbarProps {
  selectedItems: { id: string; name: string; type: 'file' | 'folder' }[];
  onClear: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedItems,
  onClear,
  onMove,
  onCopy,
  onDelete,
}) => {
  if (selectedItems.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#323232',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            color: '#9AA0A6',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
          }}
          title="Clear selection"
        >
          <X size={18} />
        </button>
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
          {selectedItems.length} selected
        </span>
      </div>

      <div style={{ width: '1px', height: '24px', backgroundColor: '#5F6368' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onMove}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
          title="Move selected items"
        >
          <FolderInput size={18} />
          <span>Move</span>
        </button>
        <button
          onClick={onCopy}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
          title="Copy selected items"
        >
          <Copy size={18} />
          <span>Copy</span>
        </button>
        <button
          onClick={onDelete}
          style={{
            background: 'none',
            border: 'none',
            color: '#F28B82',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
          title="Delete selected items"
        >
          <Trash2 size={18} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};
