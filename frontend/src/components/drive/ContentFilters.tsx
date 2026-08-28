import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Check,
  Grid,
  List,
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  Film,
  Image as ImageIcon,
  File
} from 'lucide-react';
import { FileTypeFilter, ModifiedFilter } from '../layout/Header';

interface ContentFiltersProps {
  typeFilter: FileTypeFilter;
  onTypeFilterChange: (type: FileTypeFilter) => void;
  modifiedFilter: ModifiedFilter;
  onModifiedFilterChange: (mod: ModifiedFilter) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export const ContentFilters: React.FC<ContentFiltersProps> = ({
  typeFilter,
  onTypeFilterChange,
  modifiedFilter,
  onModifiedFilterChange,
  viewMode,
  onViewModeChange,
}) => {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showModMenu, setShowModMenu] = useState(false);

  const typeMenuRef = useRef<HTMLDivElement>(null);
  const modMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false);
      }
      if (modMenuRef.current && !modMenuRef.current.contains(e.target as Node)) {
        setShowModMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const typeLabels: Record<FileTypeFilter, string> = {
    all: 'All file types',
    folders: 'Folders',
    documents: 'Documents',
    spreadsheets: 'Spreadsheets',
    presentations: 'Presentations',
    videos: 'Videos',
    images: 'Photos & images',
    pdfs: 'PDFs',
  };

  const modLabels: Record<ModifiedFilter, string> = {
    anytime: 'Anytime',
    today: 'Today',
    '7days': 'Last 7 days',
    '30days': 'Last 30 days',
    year: 'This year (2026)',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Type Filter Chip */}
      <div style={{ position: 'relative' }} ref={typeMenuRef}>
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          className={`filter-chip ${typeFilter !== 'all' ? 'active' : ''}`}
        >
          <span>{typeFilter === 'all' ? 'Type' : typeLabels[typeFilter]}</span>
          <ChevronDown size={14} />
        </button>

        {showTypeMenu && (
          <div
            className="fade-in"
            style={{
              position: 'absolute',
              top: '36px',
              right: 0,
              zIndex: 1300,
              width: '210px',
              background: '#FFFFFF',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
              border: '1px solid #E0E3E7',
              padding: '6px 0',
            }}
          >
            {(Object.keys(typeLabels) as FileTypeFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => { onTypeFilterChange(key); setShowTypeMenu(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  color: '#3C4043',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {key === 'folders' && <Folder size={16} color="#FBBC04" fill="#FBBC04" />}
                  {key === 'documents' && <FileText size={16} color="#4285F4" />}
                  {key === 'spreadsheets' && <FileSpreadsheet size={16} color="#0F9D58" />}
                  {key === 'presentations' && <Presentation size={16} color="#F4B400" />}
                  {key === 'videos' && <Film size={16} color="#EA4335" />}
                  {key === 'images' && <ImageIcon size={16} color="#9C27B0" />}
                  {key === 'pdfs' && <File size={16} color="#EA4335" />}
                  <span>{typeLabels[key]}</span>
                </div>
                {typeFilter === key && <Check size={14} color="#1A73E8" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modified Filter Chip */}
      <div style={{ position: 'relative' }} ref={modMenuRef}>
        <button
          onClick={() => setShowModMenu(!showModMenu)}
          className={`filter-chip ${modifiedFilter !== 'anytime' ? 'active' : ''}`}
        >
          <span>{modifiedFilter === 'anytime' ? 'Modified' : modLabels[modifiedFilter]}</span>
          <ChevronDown size={14} />
        </button>

        {showModMenu && (
          <div
            className="fade-in"
            style={{
              position: 'absolute',
              top: '36px',
              right: 0,
              zIndex: 1300,
              width: '180px',
              background: '#FFFFFF',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
              border: '1px solid #E0E3E7',
              padding: '6px 0',
            }}
          >
            {(Object.keys(modLabels) as ModifiedFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => { onModifiedFilterChange(key); setShowModMenu(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  color: '#3C4043',
                  cursor: 'pointer',
                }}
              >
                <span>{modLabels[key]}</span>
                {modifiedFilter === key && <Check size={14} color="#1A73E8" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* View mode toggle (Grid / List) */}
      <div style={{ display: 'flex', background: '#FFFFFF', border: '1px solid #E0E3E7', borderRadius: '8px', padding: '2px', marginLeft: '4px' }}>
        <button
          onClick={() => onViewModeChange('grid')}
          title="Grid view"
          style={{
            background: viewMode === 'grid' ? '#E8F0FE' : 'transparent',
            color: viewMode === 'grid' ? '#1A73E8' : '#5F6368',
            border: 'none',
            padding: '6px 8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <Grid size={16} />
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          title="List view"
          style={{
            background: viewMode === 'list' ? '#E8F0FE' : 'transparent',
            color: viewMode === 'list' ? '#1A73E8' : '#5F6368',
            border: 'none',
            padding: '6px 8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <List size={16} />
        </button>
      </div>
    </div>
  );
};
