import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  CloudUpload,
  Folder as FolderIcon
} from 'lucide-react';
import { FileCard, FileItem } from './FileCard';
import { FileRow } from './FileRow';
import { FolderCard, FolderItem } from './FolderCard';
import { Breadcrumbs } from './Breadcrumbs';
import { NewFolderModal, RenameModal, MoveModal, DeleteConfirmModal } from './Modals';
import { FilePreviewModal } from './FilePreviewModal';
import { ShareModal } from './ShareModal';
import { OfficeEditorModal } from '../office/OfficeEditorModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { ContextMenu } from './ContextMenu';
import { useUpload } from '../../context/UploadContext';
import { FileTypeFilter, ModifiedFilter } from '../layout/Header';
import { ContentFilters } from './ContentFilters';
import { SelectionMarquee, SelectionToolbar } from './SelectionMarquee';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface MyDriveProps {
  searchQuery?: string;
  typeFilter?: FileTypeFilter;
  onTypeFilterChange?: (t: FileTypeFilter) => void;
  modifiedFilter?: ModifiedFilter;
  onModifiedFilterChange?: (m: ModifiedFilter) => void;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (v: 'grid' | 'list') => void;
  onNavigateFolder?: (folderId: string | null) => void;
}

export const MyDrive: React.FC<MyDriveProps> = ({
  searchQuery = '',
  typeFilter = 'all',
  onTypeFilterChange = () => { },
  modifiedFilter = 'anytime',
  onModifiedFilterChange = () => { },
  viewMode = 'grid',
  onViewModeChange = () => { },
}) => {
  const { uploadFiles } = useUpload();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'My Drive' }]);
  const [loading, setLoading] = useState(true);

  // Selection states
  const [selectedItems, setSelectedItems] = useState<{ id: string; name: string; type: 'file' | 'folder' }[]>([]);
  const lastSelectedRef = useRef<{ id: string; type: 'file' | 'folder' } | null>(null);
  const [multiContextMenuPos, setMultiContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showBatchMoveModal, setShowBatchMoveModal] = useState<{ mode: 'move' | 'copy' } | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // Marquee (Rubber-Band) Drag Selection State
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const isMouseDownOnBg = useRef(false);
  const marqueeStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Modals & Context Menu state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [workspaceContextMenuPos, setWorkspaceContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [sharingItem, setSharingItem] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [editingOfficeFile, setEditingOfficeFile] = useState<FileItem | null>(null);
  const [versionHistoryFile, setVersionHistoryFile] = useState<FileItem | null>(null);
  const [renamingItem, setRenamingItem] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [movingItem, setMovingItem] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [previewingFile, setPreviewingFile] = useState<FileItem | null>(null);

  // Drag-and-drop state for OS File Upload
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const folderParam = currentFolderId ? `?parentId=${currentFolderId}` : '';
      const fileParam = currentFolderId ? `?folderId=${currentFolderId}` : '';

      const [foldersRes, filesRes] = await Promise.all([
        fetch(`/api/folders${folderParam}`, { credentials: 'include' }),
        fetch(`/api/files${fileParam}`, { credentials: 'include' }),
      ]);

      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(foldersData.folders || []);
        if (foldersData.breadcrumbs) {
          setBreadcrumbs(foldersData.breadcrumbs);
        }
      }

      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setFiles(filesData.files || []);
      }
    } catch (err) {
      console.error('Failed to load drive contents:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    fetchContents();
    setSelectedItems([]);
  }, [fetchContents]);

  // Standard Item Click Selection
  const handleSelectItem = (e: React.MouseEvent, item: { id: string; name: string; type: 'file' | 'folder' }) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems((prev) => {
        const exists = prev.some((p) => p.id === item.id && p.type === item.type);
        if (exists) return prev.filter((p) => !(p.id === item.id && p.type === item.type));
        return [...prev, item];
      });
      lastSelectedRef.current = item;
    } else if (e.shiftKey && lastSelectedRef.current) {
      const allItems = [
        ...folders.map((f) => ({ id: f.id, name: f.name, type: 'folder' as const })),
        ...files.map((f) => ({ id: f.id, name: f.name, type: 'file' as const })),
      ];
      const lastIdx = allItems.findIndex((i) => i.id === lastSelectedRef.current?.id && i.type === lastSelectedRef.current?.type);
      const currIdx = allItems.findIndex((i) => i.id === item.id && i.type === item.type);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        setSelectedItems(allItems.slice(start, end + 1));
      }
    } else {
      setSelectedItems([item]);
      lastSelectedRef.current = item;
    }
  };

  // Drag start handler for items
  const handleDragStartItem = (e: React.DragEvent, item: { id: string; name: string; type: 'file' | 'folder' }) => {
    const isCurrentSelected = selectedItems.some((s) => s.id === item.id && s.type === item.type);
    const itemsToDrag = isCurrentSelected ? selectedItems : [item];
    if (!isCurrentSelected) {
      setSelectedItems([item]);
    }
    e.dataTransfer.setData('application/x-clouddrive-items', JSON.stringify(itemsToDrag));
    e.dataTransfer.effectAllowed = 'move';
  };

  // Drop onto a folder card or breadcrumb
  const handleDropOnFolder = async (targetFolderId: string | null, droppedItems: { id: string; name: string; type: 'file' | 'folder' }[]) => {
    const validItems = droppedItems.filter((i) => !(i.type === 'folder' && i.id === targetFolderId));
    if (validItems.length === 0) return;

    try {
      const res = await fetch('/api/resources/batch-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resources: validItems,
          targetFolderId: targetFolderId || 'root',
        }),
        credentials: 'include',
      });

      if (res.ok) {
        setSelectedItems([]);
        fetchContents();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to move items');
      }
    } catch (err) {
      console.error('Error moving items via drag and drop:', err);
    }
  };

  // Marquee (Rubber-Band) Selection Engine
  const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-item-id], button, input, a, .modal, .content-filters, .floating-action-bar')) return;

    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setSelectedItems([]);
    }
    isMouseDownOnBg.current = true;
    marqueeStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleRightClickStart = (item: { id: string; name: string; type: 'file' | 'folder' }) => {
    const isCurrentSelected = selectedItems.some((s) => s.id === item.id && s.type === item.type);
    if (!isCurrentSelected) {
      setSelectedItems([item]);
    }
  };

  const handleHoverSelect = (item: { id: string; name: string; type: 'file' | 'folder' }) => {
    if (isMouseDownOnBg.current) {
      setSelectedItems((prev) => {
        if (prev.some((p) => p.id === item.id && p.type === item.type)) return prev;
        return [...prev, item];
      });
    }
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isMouseDownOnBg.current) return;
      const startX = marqueeStartPos.current.x;
      const startY = marqueeStartPos.current.y;
      const currentX = e.clientX;
      const currentY = e.clientY;

      if (Math.hypot(currentX - startX, currentY - startY) > 3) {
        setMarquee({ startX, startY, currentX, currentY });

        const minX = Math.min(startX, currentX);
        const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY);
        const maxY = Math.max(startY, currentY);

        const elements = document.querySelectorAll('[data-item-id]');
        const newlySelected: { id: string; name: string; type: 'file' | 'folder' }[] = [];

        elements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const overlaps = !(rect.right < minX || rect.left > maxX || rect.bottom < minY || rect.top > maxY);
          if (overlaps) {
            const id = el.getAttribute('data-item-id');
            const type = el.getAttribute('data-item-type') as 'file' | 'folder';
            if (id && type) {
              const itemDetails = type === 'folder'
                ? folders.find(f => f.id === id)
                : files.find(f => f.id === id);
              const name = itemDetails?.name || (itemDetails as any)?.originalName || '';
              newlySelected.push({ id, name, type });
            }
          }
        });
        setSelectedItems(newlySelected);
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownOnBg.current = false;
        setMarquee(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [folders, files]);

  // Keyboard Shortcuts (Cmd+A, Escape, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allItems = [
          ...folders.map((f) => ({ id: f.id, name: f.name, type: 'folder' as const })),
          ...files.map((f) => ({ id: f.id, name: f.name, type: 'file' as const })),
        ];
        setSelectedItems(allItems);
      } else if (e.key === 'Escape') {
        setSelectedItems([]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItems.length > 0) {
          setShowBatchDeleteModal(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [folders, files, selectedItems]);

  // Drag & Drop Handlers for OS File Uploads (Isolates from internal move drags)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/x-clouddrive-items')) {
      dragCounter.current += 1;
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/x-clouddrive-items')) {
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDraggingOver(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;

    // Do nothing on background drop for internal item drags (prevents duplicate copy/upload)
    if (e.dataTransfer.types.includes('application/x-clouddrive-items')) {
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files, currentFolderId);
    }
  };

  const handleDownload = (file: FileItem) => {
    const downloadUrl = `/api/files/${file.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleStar = async (resource: FileItem | FolderItem, type: 'file' | 'folder') => {
    try {
      await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, resourceType: type }),
        credentials: 'include',
      });
      fetchContents();
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  // Filter items by search query and type/modified filters
  const filteredFolders = folders.filter((f) => {
    if (typeFilter !== 'all' && typeFilter !== 'folders') return false;
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredFiles = files.filter((file) => {
    if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Type Filter
    if (typeFilter !== 'all') {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const mime = (file.mimeType || '').toLowerCase();

      if (typeFilter === 'documents' && !(['doc', 'docx', 'txt', 'md', 'rtf', 'odt'].includes(ext) || mime.includes('document') || mime.includes('word'))) return false;
      if (typeFilter === 'spreadsheets' && !(['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('sheet') || mime.includes('excel'))) return false;
      if (typeFilter === 'presentations' && !(['ppt', 'pptx', 'odp'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint'))) return false;
      if (typeFilter === 'videos' && !(mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext))) return false;
      if (typeFilter === 'images' && !(mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))) return false;
      if (typeFilter === 'pdfs' && !(ext === 'pdf' || mime.includes('pdf'))) return false;
      if (typeFilter === 'folders') return false;
    }

    // Modified Filter
    if (modifiedFilter !== 'anytime') {
      const fileDate = new Date(file.createdAt).getTime();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      if (modifiedFilter === 'today' && now - fileDate > dayMs) return false;
      if (modifiedFilter === '7days' && now - fileDate > 7 * dayMs) return false;
      if (modifiedFilter === '30days' && now - fileDate > 30 * dayMs) return false;
      if (modifiedFilter === 'year' && new Date(file.createdAt).getFullYear() !== new Date().getFullYear()) return false;
    }

    return true;
  });

  const isEmpty = filteredFolders.length === 0 && filteredFiles.length === 0;
  const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || 'My Drive';

  const handleWorkspaceContextMenu = (e: React.MouseEvent) => {
    // Only open workspace menu if right-clicking on workspace background area
    e.preventDefault();
    setWorkspaceContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files, currentFolderId);
      e.target.value = '';
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files, currentFolderId);
      e.target.value = '';
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleWorkspaceContextMenu}
      onMouseDown={handleWorkspaceMouseDown}
      className="content-surface"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px 24px',
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      <SelectionMarquee box={marquee} />
      <SelectionToolbar
        selectedItems={selectedItems}
        onClear={() => setSelectedItems([])}
        onMove={() => setShowBatchMoveModal({ mode: 'move' })}
        onCopy={() => setShowBatchMoveModal({ mode: 'copy' })}
        onDelete={() => setShowBatchDeleteModal(true)}
      />

      {/* Hidden Upload Inputs for Right-Click Workspace Menu */}
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
      {/* Drop Zone Overlay */}
      {isDraggingOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(232, 240, 254, 0.95)',
            border: '2px dashed #1A73E8',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <CloudUpload size={64} color="#1A73E8" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1A73E8', marginTop: '1rem' }}>
            Drop files to upload to {currentFolderName}
          </h2>
        </div>
      )}

      {/* Top Header / Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',

        borderBottom: '1px solid #E0E3E7',
        marginBottom: '24px',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <h1 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#1F1F1F',
            margin: 0,
            padding: '8px 12px',
            background: '#D3E3FD',
            borderBottom: '3px solid #0B57D0',
            borderRadius: '8px 8px 0 0'
          }}>
            {currentFolderName}
          </h1>

          {breadcrumbs.length > 1 && (
            <Breadcrumbs
              items={breadcrumbs}
              onNavigate={(id) => setCurrentFolderId(id)}
              onDropOnFolder={handleDropOnFolder}
            />
          )}
        </div>

        <ContentFilters
          typeFilter={typeFilter}
          onTypeFilterChange={onTypeFilterChange}
          modifiedFilter={modifiedFilter}
          onModifiedFilterChange={onModifiedFilterChange}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Loader2 size={36} className="spin" color="#1A73E8" />
        </div>
      ) : isEmpty ? (
        /* Empty State matching Reference Screenshot */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '12px',
            padding: '4rem 1rem',
          }}
        >
          {/* Light Blue Rounded Box with Folder Outline */}
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '24px',
              background: '#F0F4F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FolderIcon size={38} color="#0B57D0" strokeWidth={1.8} />
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
            Empty folder
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#72777A', maxWidth: '320px', margin: 0 }}>
            Drop files here or click <strong>+ New</strong> above to upload items to this folder.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Folders Section */}
          {filteredFolders.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#5F6368', textTransform: 'uppercase', marginBottom: '12px' }}>
                Folders
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '12px',
                }}
              >
                {filteredFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={(id) => setCurrentFolderId(id)}
                    onShare={(f) => setSharingItem({ id: f.id, name: f.name, type: 'folder' })}
                    onRename={(f) => setRenamingItem({ id: f.id, name: f.name, type: 'folder' })}
                    onMove={(f) => setMovingItem({ id: f.id, name: f.name, type: 'folder' })}
                    onDelete={(f) => setDeletingItem({ id: f.id, name: f.name, type: 'folder' })}
                    onToggleStar={(f) => handleToggleStar(f, 'folder')}
                    isSelected={selectedItems.some((s) => s.id === folder.id && s.type === 'folder')}
                    onRightClickStart={handleRightClickStart}
                    onHoverSelect={handleHoverSelect}
                    onSelect={handleSelectItem}
                    onDragStartItem={handleDragStartItem}
                    onDropOnFolder={handleDropOnFolder}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {filteredFiles.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#5F6368', textTransform: 'uppercase', marginBottom: '12px' }}>
                Files
              </div>

              {viewMode === 'grid' ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '14px',
                  }}
                >
                  {filteredFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onPreview={(f) => setPreviewingFile(f)}
                      onOpenOffice={(f) => setEditingOfficeFile(f)}
                      onToggleStar={(f) => handleToggleStar(f, 'file')}
                      onVersionHistory={(f) => setVersionHistoryFile(f)}
                      onDownload={(f) => handleDownload(f)}
                      onShare={(f) => setSharingItem({ id: f.id, name: f.name, type: 'file' })}
                      onRename={(f) => setRenamingItem({ id: f.id, name: f.name, type: 'file' })}
                      onMove={(f) => setMovingItem({ id: f.id, name: f.name, type: 'file' })}
                      onDelete={(f) => setDeletingItem({ id: f.id, name: f.name, type: 'file' })}
                      isSelected={selectedItems.some((s) => s.id === file.id && s.type === 'file')}
                      onRightClickStart={handleRightClickStart}
                      onHoverSelect={handleHoverSelect}
                      onSelect={handleSelectItem}
                      onDragStartItem={handleDragStartItem}
                    />
                  ))}
                </div>
              ) : (
                /* List View */
                <div style={{ border: '1px solid #E0E3E7', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 2.5fr) 140px 100px 130px 130px',
                      padding: '10px 16px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#5F6368',
                      borderBottom: '1px solid #E0E3E7',
                      background: '#F8FAFD',
                    }}
                  >
                    <span>Name</span>
                    <span>Type</span>
                    <span>Size</span>
                    <span>Modified</span>
                    <span style={{ textAlign: 'right' }}>Actions</span>
                  </div>

                  {filteredFiles.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      onPreview={(f) => setPreviewingFile(f)}
                      onOpenOffice={(f) => setEditingOfficeFile(f)}
                      onToggleStar={(f) => handleToggleStar(f, 'file')}
                      onVersionHistory={(f) => setVersionHistoryFile(f)}
                      onDownload={(f) => handleDownload(f)}
                      onShare={(f) => setSharingItem({ id: f.id, name: f.name, type: 'file' })}
                      onRename={(f) => setRenamingItem({ id: f.id, name: f.name, type: 'file' })}
                      onMove={(f) => setMovingItem({ id: f.id, name: f.name, type: 'file' })}
                      onDelete={(f) => setDeletingItem({ id: f.id, name: f.name, type: 'file' })}
                      isSelected={selectedItems.some((s) => s.id === file.id && s.type === 'file')}
                      onRightClickStart={handleRightClickStart}
                      onHoverSelect={handleHoverSelect}
                      onSelect={handleSelectItem}
                      onDragStartItem={handleDragStartItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewFolder && (
        <NewFolderModal
          currentFolderId={currentFolderId}
          onClose={() => setShowNewFolder(false)}
          onSuccess={fetchContents}
        />
      )}

      {sharingItem && (
        <ShareModal
          resourceId={sharingItem.id}
          resourceName={sharingItem.name}
          resourceType={sharingItem.type}
          onClose={() => setSharingItem(null)}
        />
      )}

      {editingOfficeFile && (
        <OfficeEditorModal
          file={editingOfficeFile}
          onClose={() => setEditingOfficeFile(null)}
          onSaved={fetchContents}
          onSwitchToPreview={() => {
            setPreviewingFile(editingOfficeFile);
            setEditingOfficeFile(null);
          }}
        />
      )}

      {versionHistoryFile && (
        <VersionHistoryModal
          fileId={versionHistoryFile.id}
          fileName={versionHistoryFile.name}
          onClose={() => setVersionHistoryFile(null)}
          onRestored={fetchContents}
        />
      )}

      {renamingItem && (
        <RenameModal
          item={renamingItem}
          onClose={() => setRenamingItem(null)}
          onSuccess={fetchContents}
        />
      )}

      {movingItem && (
        <MoveModal
          items={[movingItem]}
          onClose={() => setMovingItem(null)}
          onSuccess={fetchContents}
        />
      )}

      {deletingItem && (
        <DeleteConfirmModal
          items={[deletingItem]}
          onClose={() => setDeletingItem(null)}
          onSuccess={fetchContents}
        />
      )}

      {previewingFile && (
        <FilePreviewModal
          file={previewingFile}
          onClose={() => setPreviewingFile(null)}
          onOpenOffice={() => setEditingOfficeFile(previewingFile)}
          onDownload={() => handleDownload(previewingFile)}
        />
      )}

      {/* Multi-Select Modals */}
      {showBatchMoveModal && (
        <MoveModal
          items={selectedItems}
          mode={showBatchMoveModal.mode}
          onClose={() => setShowBatchMoveModal(null)}
          onSuccess={() => {
            fetchContents();
            setSelectedItems([]);
          }}
        />
      )}

      {showBatchDeleteModal && (
        <DeleteConfirmModal
          items={selectedItems}
          onClose={() => setShowBatchDeleteModal(false)}
          onSuccess={() => {
            fetchContents();
            setSelectedItems([]);
          }}
        />
      )}

      {/* Right-Click Workspace Context Menu */}
      {workspaceContextMenuPos && (
        <ContextMenu
          x={workspaceContextMenuPos.x}
          y={workspaceContextMenuPos.y}
          type="workspace"
          onClose={() => setWorkspaceContextMenuPos(null)}
          onNewFolder={() => setShowNewFolder(true)}
          onUploadFile={() => fileInputRef.current?.click()}
          onUploadFolder={() => folderInputRef.current?.click()}
        />
      )}

      {/* Multi-Select Context Menu */}
      {multiContextMenuPos && selectedItems.length > 0 && (
        <ContextMenu
          x={multiContextMenuPos.x}
          y={multiContextMenuPos.y}
          type="multi"
          onClose={() => setMultiContextMenuPos(null)}
          onMoveSelected={() => setShowBatchMoveModal({ mode: 'move' })}
          onCopySelected={() => setShowBatchMoveModal({ mode: 'copy' })}
          onDeleteSelected={() => setShowBatchDeleteModal(true)}
          onClearSelection={() => setSelectedItems([])}
        />
      )}
    </div>
  );
};
