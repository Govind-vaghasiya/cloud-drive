import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { TwoFactorSetupModal } from './components/auth/TwoFactorSetupModal';
import { AdminQuotaModal } from './components/auth/AdminQuotaModal';
import { Header, FileTypeFilter, ModifiedFilter } from './components/layout/Header';
import { Sidebar, SidebarTab } from './components/layout/Sidebar';
import { ActivityPanel } from './components/layout/ActivityPanel';
import { MyDrive } from './components/drive/MyDrive';
import { StarredScreen } from './components/drive/StarredScreen';
import { SharedWithMe } from './components/drive/SharedWithMe';
import { TrashScreen } from './components/drive/TrashScreen';
import { ManageShares } from './components/drive/ManageShares';
import { AccountScreen } from './components/account/AccountScreen';
import { AdminUserManagement } from './components/admin/AdminUserManagement';
import { PublicSharePage } from './components/drive/PublicSharePage';
import { UploadDrawer } from './components/drive/UploadDrawer';
import { PwaInstallPrompt } from './components/pwa/PwaInstallPrompt';
import { NewFolderModal } from './components/drive/Modals';

function MainContent() {
  const { loading: authLoading, isAuthenticated, show2FASetup, setShow2FASetup, showAdminModal, setShowAdminModal } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  // Shell State
  const [activeTab, setActiveTab] = useState<SidebarTab>('drive');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<FileTypeFilter>('all');
  const [selectedModifiedFilter, setSelectedModifiedFilter] = useState<ModifiedFilter>('anytime');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showActivityPanel, setShowActivityPanel] = useState(true);

  // 1. Check for Public Share Link /s/:token
  const publicShareMatch = window.location.pathname.match(/^\/s\/([a-zA-Z0-9_-]+)/);
  if (publicShareMatch) {
    return <PublicSharePage token={publicShareMatch[1]} />;
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: '#5F6368', gap: '12px', background: '#F8FAFD' }}>
        <Loader2 size={32} className="spin" color="#1A73E8" />
        <span style={{ fontSize: '1rem', fontWeight: 500 }}>Loading Google Drive...</span>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFD', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        {authView === 'login' ? (
          <LoginForm
            onSwitchToRegister={() => setAuthView('register')}
            onForgotPassword={() => setShowForgotModal(true)}
          />
        ) : (
          <RegisterForm
            onSwitchToLogin={() => setAuthView('login')}
          />
        )}

        {showForgotModal && (
          <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />
        )}
      </div>
    );
  }

  // 3. Authenticated State: Google Drive 3-Column Shell
  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTypeFilter={selectedTypeFilter}
        onTypeFilterChange={setSelectedTypeFilter}
        selectedModifiedFilter={selectedModifiedFilter}
        onModifiedFilterChange={setSelectedModifiedFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showActivityPanel={showActivityPanel}
        onToggleActivityPanel={() => setShowActivityPanel(!showActivityPanel)}
        onOpenAdminModal={() => setShowAdminModal(true)}
        onOpen2FAModal={() => setShow2FASetup(true)}
        onNavigateToAdmin={() => setActiveTab('admin-users')}
      />

      {/* Main 3-Column Layout: Sidebar + Content Surface + Activity Panel */}
      <div className="main-layout">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onNewFolder={() => setShowNewFolderModal(true)}
        />

        {/* Center Content Surface */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {(activeTab === 'drive' || activeTab === 'recent') && (
            <MyDrive
              searchQuery={searchQuery}
              typeFilter={selectedTypeFilter}
              modifiedFilter={selectedModifiedFilter}
              viewMode={viewMode}
            />
          )}

          {activeTab === 'starred' && (
            <StarredScreen
              searchQuery={searchQuery}
              typeFilter={selectedTypeFilter}
              modifiedFilter={selectedModifiedFilter}
              viewMode={viewMode}
            />
          )}

          {activeTab === 'shared' && <SharedWithMe />}
          {activeTab === 'trash' && <TrashScreen />}
          {activeTab === 'manage' && <ManageShares />}
          {activeTab === 'account' && <AccountScreen onNavigateToAdmin={() => setActiveTab('admin-users')} />}
          {activeTab === 'admin-users' && <AdminUserManagement />}
        </main>

        {/* Right Collapsible Activity Panel */}
        {showActivityPanel && (
          <ActivityPanel onClose={() => setShowActivityPanel(false)} />
        )}
      </div>

      {/* Persistent Upload Progress Drawer */}
      <UploadDrawer />

      {/* PWA Mobile & Desktop Install Prompt */}
      <PwaInstallPrompt />

      {/* Global Modals */}
      {showNewFolderModal && (
        <NewFolderModal
          currentFolderId={null}
          onClose={() => setShowNewFolderModal(false)}
          onSuccess={() => {
            // Trigger refresh via state / event
            setShowNewFolderModal(false);
          }}
        />
      )}

      {show2FASetup && <TwoFactorSetupModal onClose={() => setShow2FASetup(false)} />}
      {showAdminModal && <AdminQuotaModal onClose={() => setShowAdminModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UploadProvider>
        <MainContent />
      </UploadProvider>
    </AuthProvider>
  );
}
