import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  FolderPlus,
  Upload,
  FolderUp,
  HardDrive,
  Clock,
  Star,
  Users,
  Trash2,
  Share2,
  FileText,
  FileSpreadsheet,
  Presentation,
  Cloud,
  Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUpload } from '../../context/UploadContext';

export type SidebarTab = 'drive' | 'recent' | 'starred' | 'shared' | 'trash' | 'manage' | 'account' | 'admin-users';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onNewFolder: () => void;
  onUploadOfficeDoc?: (type: 'docx' | 'xlsx' | 'pptx') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onNewFolder,
  onUploadOfficeDoc,
}) => {
  const { user } = useAuth();
  const { uploadFiles } = useUpload();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files, null);
      e.target.value = '';
      setShowNewMenu(false);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files, null);
      e.target.value = '';
      setShowNewMenu(false);
    }
  };

  const quotaBytes = user?.storageQuotaBytes || 107374182400; // 100 GB default
  const usedBytes = user?.storageUsedBytes || 0;
  const quotaPercent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);
  const totalGb = (quotaBytes / (1024 * 1024 * 1024)).toFixed(0);



  return (
    <aside
      style={{
        width: '240px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '8px 0',
      }}
    >
      {/* Hidden Upload Inputs */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        // @ts-expect-error webkitdirectory is standard for folder uploads
        webkitdirectory="true"
        directory=""
        multiple
        ref={folderInputRef}
        onChange={handleFolderChange}
        style={{ display: 'none' }}
      />

      {/* Top Section: + New Button and Nav List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* + New Button with Dropdown Menu */}
        <div style={{ position: 'relative', paddingLeft: '8px' }} ref={menuRef}>
          <button
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="btn-new"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              borderRadius: '16px',
              background: '#FFFFFF',
              border: '1px solid #E0E3E7',
              boxShadow: '0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#1F1F1F',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={22} color="#1A73E8" strokeWidth={2.5} />
            </div>
            <span>New</span>
          </button>

          {/* New Action Dropdown */}
          {showNewMenu && (
            <div
              className="fade-in"
              style={{
                position: 'absolute',
                top: '56px',
                left: '8px',
                zIndex: 1200,
                width: '230px',
                background: '#FFFFFF',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
                border: '1px solid #E0E3E7',
                padding: '6px 0',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <button
                onClick={() => { onNewFolder(); setShowNewMenu(false); }}
                style={dropdownItemStyle}
              >
                <FolderPlus size={18} color="#5F6368" />
                <span>New folder</span>
              </button>

              <div style={{ height: '1px', background: '#E0E3E7', margin: '4px 0' }} />

              <button
                onClick={() => { fileInputRef.current?.click(); }}
                style={dropdownItemStyle}
              >
                <Upload size={18} color="#5F6368" />
                <span>File upload</span>
              </button>

              <button
                onClick={() => { folderInputRef.current?.click(); }}
                style={dropdownItemStyle}
              >
                <FolderUp size={18} color="#5F6368" />
                <span>Folder upload</span>
              </button>

              <div style={{ height: '1px', background: '#E0E3E7', margin: '4px 0' }} />

              <button
                onClick={() => { if (onUploadOfficeDoc) onUploadOfficeDoc('docx'); setShowNewMenu(false); }}
                style={dropdownItemStyle}
              >
                <FileText size={18} color="#4285F4" />
                <span>Google Docs / Word</span>
              </button>

              <button
                onClick={() => { if (onUploadOfficeDoc) onUploadOfficeDoc('xlsx'); setShowNewMenu(false); }}
                style={dropdownItemStyle}
              >
                <FileSpreadsheet size={18} color="#0F9D58" />
                <span>Google Sheets / Excel</span>
              </button>

              <button
                onClick={() => { if (onUploadOfficeDoc) onUploadOfficeDoc('pptx'); setShowNewMenu(false); }}
                style={dropdownItemStyle}
              >
                <Presentation size={18} color="#F4B400" />
                <span>Google Slides / PPT</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Item Pills */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '12px' }}>
          <button
            onClick={() => onTabChange('drive')}
            className={`nav-pill ${activeTab === 'drive' ? 'active' : ''}`}
          >
            <HardDrive size={18} color={activeTab === 'drive' ? '#001D35' : '#444746'} />
            <span>My Drive</span>
          </button>

          <button
            onClick={() => onTabChange('recent')}
            className={`nav-pill ${activeTab === 'recent' ? 'active' : ''}`}
          >
            <Clock size={18} color={activeTab === 'recent' ? '#001D35' : '#444746'} />
            <span>Recent</span>
          </button>

          <button
            onClick={() => onTabChange('starred')}
            className={`nav-pill ${activeTab === 'starred' ? 'active' : ''}`}
          >
            <Star size={18} color={activeTab === 'starred' ? '#001D35' : '#444746'} />
            <span>Starred</span>
          </button>

          <button
            onClick={() => onTabChange('shared')}
            className={`nav-pill ${activeTab === 'shared' ? 'active' : ''}`}
          >
            <Users size={18} color={activeTab === 'shared' ? '#001D35' : '#444746'} />
            <span>Shared with me</span>
          </button>

          <button
            onClick={() => onTabChange('trash')}
            className={`nav-pill ${activeTab === 'trash' ? 'active' : ''}`}
          >
            <Trash2 size={18} color={activeTab === 'trash' ? '#001D35' : '#444746'} />
            <span>Trash</span>
          </button>

          <button
            onClick={() => onTabChange('manage')}
            className={`nav-pill ${activeTab === 'manage' ? 'active' : ''}`}
          >
            <Share2 size={18} color={activeTab === 'manage' ? '#001D35' : '#444746'} />
            <span>Manage Shares</span>
          </button>


        </nav>
      </div>

      {/* Bottom Section: Settings Links + Storage Quota */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 12px 8px 8px' }}>
        {/* Divider */}
        <div style={{ height: '1px', background: '#E0E3E7', margin: '0 -4px' }} />

        {/* Account Settings */}
        <button
          onClick={() => onTabChange('account')}
          className={`nav-pill ${activeTab === 'account' ? 'active' : ''}`}
          style={{ paddingRight: 0 }}
        >
          <Settings size={18} color={activeTab === 'account' ? '#001D35' : '#444746'} />
          <span>Account Settings</span>
        </button>

        {/* Admin: User Management */}
        {user?.role === 'admin' && (
          <button
            onClick={() => onTabChange('admin-users')}
            className={`nav-pill ${activeTab === 'admin-users' ? 'active' : ''}`}
            style={{
              background: activeTab === 'admin-users' ? '#C2E7FF' : '#1b5285',
              border: '1px solid #505050ff',
              paddingRight: 0,
            }}
          >
            <Users size={18} color={activeTab === 'admin-users' ? '#001D35' : '#ffffffff'} />
            <span style={{ color: activeTab === 'admin-users' ? '#001D35' : '#ffffffff', fontWeight: 700 }}>
              Admin Panel
            </span>
          </button>
        )}

        {/* Storage Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cloud size={16} color="#5F6368" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#5F6368', textTransform: 'uppercase' }}>
              Storage
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: '4px',
              background: '#E0E3E7',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${quotaPercent}%`,
                height: '100%',
                background: quotaPercent > 90 ? '#C5221F' : '#1A73E8',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ fontSize: '0.75rem', color: '#72777A' }}>
            {usedGb} GB of {totalGb} GB used
          </div>
        </div>
      </div>
    </aside>
  );
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 16px',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  fontSize: '0.88rem',
  color: '#3C4043',
  cursor: 'pointer',
  transition: 'background 0.15s',
};
