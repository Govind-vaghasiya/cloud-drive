import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Info,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type FileTypeFilter = 'all' | 'folders' | 'documents' | 'spreadsheets' | 'presentations' | 'videos' | 'images' | 'pdfs';
export type ModifiedFilter = 'anytime' | 'today' | '7days' | '30days' | 'year';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showActivityPanel: boolean;
  onToggleActivityPanel: () => void;
  onOpenAdminModal?: () => void;
  onOpen2FAModal?: () => void;
  onNavigateToAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  showActivityPanel,
  onToggleActivityPanel,
  onOpenAdminModal,
  onOpen2FAModal,
  onNavigateToAdmin,
}) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
    : 'U';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 17) return 'Good afternoon!';
    return 'Good evening';
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        gap: '16px',
        height: '64px',
        background: 'var(--bg-app)',
      }}
    >
      {/* 1. Left: Brand Logo only — fixed 240px to match sidebar width */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: '240px' }}>
        <img
          src="/logo-long.png"
          alt="Govind Drive"
          style={{ height: '40px', objectFit: 'contain' }}
        />
      </div>

      {/* 2. Greeting — starts at the left edge of search bar */}
      {user && (
        <div
          style={{
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {getGreeting()}
          <span
            style={{
              fontSize: '1.2rem',
              fontWeight: 500,
              color: '#1F1F1F',
              letterSpacing: '-0.01em',
            }}
          >
            &nbsp; &nbsp;{user.name}
          </span>
        </div>
      )}

      {/* 3. Center: Search Pill Bar */}
      <div style={{ flex: 1, maxWidth: '720px', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-search)',
            borderRadius: '24px',
            padding: '4px 16px',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          <Search size={20} color="#5F6368" style={{ marginRight: '10px', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search in Drive..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.95rem',
              color: '#1F1F1F',
              padding: '8px 0',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#5F6368',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Right: Tools & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Activity Side Panel Toggle [i] */}
        <button
          onClick={onToggleActivityPanel}
          title="Activity & details"
          style={{
            background: showActivityPanel ? '#E8F0FE' : 'transparent',
            color: showActivityPanel ? '#1A73E8' : '#5F6368',
            border: '1px solid #E0E3E7',
            padding: '7px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <Info size={18} />
        </button>

        {/* User Profile Avatar with Dropdown */}
        <div style={{ position: 'relative', marginLeft: '4px' }} ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#0B57D0',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            {user?.image ? (
              <img src={user.image} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : initials}
          </button>

          {showUserMenu && user && (
            <div
              className="fade-in"
              style={{
                position: 'absolute',
                top: '44px',
                right: 0,
                zIndex: 1300,
                width: '260px',
                background: '#FFFFFF',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.18)',
                border: '1px solid #E0E3E7',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: '#0B57D0',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                    overflow: 'hidden',
                  }}
                >
                  {user.image ? (
                    <img src={user.image} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : initials}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#5F6368', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: '#E0E3E7' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {user.role === 'admin' && onNavigateToAdmin && (
                  <button
                    onClick={() => { onNavigateToAdmin(); setShowUserMenu(false); }}
                    style={{
                      ...menuRowStyle,
                      background: '#1b5285',
                      color: '#ffffffff',
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={16} color="#ffffffff" />
                    <span>Admin Panel</span>
                  </button>
                )}

                {user.role === 'admin' && onOpenAdminModal && (
                  <button
                    onClick={() => { onOpenAdminModal(); setShowUserMenu(false); }}
                    style={menuRowStyle}
                  >
                    <Settings size={16} color="#1A73E8" />
                    <span>Quick Quotas Modal</span>
                  </button>
                )}

                {onOpen2FAModal && (
                  <button
                    onClick={() => { onOpen2FAModal(); setShowUserMenu(false); }}
                    style={menuRowStyle}
                  >
                    {user.twoFactorEnabled ? <ShieldCheck size={16} color="#137333" /> : <ShieldAlert size={16} color="#EA4335" />}
                    <span>{user.twoFactorEnabled ? '2FA Enabled' : 'Enable 2FA'}</span>
                  </button>
                )}

                <button
                  onClick={() => { logout(); setShowUserMenu(false); }}
                  style={{ ...menuRowStyle, color: '#C5221F' }}
                >
                  <LogOut size={16} color="#C5221F" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const menuRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 10px',
  background: 'none',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#3C4043',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
};
