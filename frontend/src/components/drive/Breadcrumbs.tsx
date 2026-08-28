import React, { useState } from 'react';
import { ChevronRight, HardDrive, Folder } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
  onDropOnFolder?: (targetFolderId: string | null, items: { id: string; name: string; type: 'file' | 'folder' }[]) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, onNavigate, onDropOnFolder }) => {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number, isLast: boolean) => {
    if (isLast) return;
    if (e.dataTransfer.types.includes('application/x-clouddrive-items')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, item: BreadcrumbItem, isLast: boolean) => {
    setDragOverIndex(null);
    if (isLast) return;
    if (e.dataTransfer.types.includes('application/x-clouddrive-items')) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const rawData = e.dataTransfer.getData('application/x-clouddrive-items');
        if (rawData) {
          const items = JSON.parse(rawData);
          if (Array.isArray(items) && onDropOnFolder) {
            onDropOnFolder(item.id === 'root' ? null : item.id, items);
          }
        }
      } catch (err) {
        console.error('Failed parsing dropped items on breadcrumb:', err);
      }
    }
  };

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.95rem' }}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isRoot = item.id === 'root';
        const isOver = dragOverIndex === index;

        return (
          <React.Fragment key={item.id}>
            {index > 0 && <ChevronRight size={16} color="var(--text-muted)" />}
            <button
              onClick={() => onNavigate(isRoot ? null : item.id)}
              disabled={isLast}
              onDragOver={(e) => handleDragOver(e, index, isLast)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item, isLast)}
              style={{
                background: isOver ? '#E8F0FE' : 'none',
                border: isOver ? '1px dashed #1A73E8' : 'none',
                color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isLast ? 700 : 500,
                cursor: isLast ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 0.15s',
              }}
            >
              {isRoot ? <HardDrive size={16} color="#3b82f6" /> : <Folder size={16} color="#f59e0b" />}
              <span>{item.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
