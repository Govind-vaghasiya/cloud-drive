import React from 'react';
import { ChevronRight, HardDrive, Folder } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, onNavigate }) => {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.95rem' }}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isRoot = item.id === 'root';

        return (
          <React.Fragment key={item.id}>
            {index > 0 && <ChevronRight size={16} color="var(--text-muted)" />}
            <button
              onClick={() => onNavigate(isRoot ? null : item.id)}
              disabled={isLast}
              style={{
                background: 'none',
                border: 'none',
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
