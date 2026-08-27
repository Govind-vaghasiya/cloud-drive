import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  Download, 
  Loader2, 
  AlertTriangle, 
  Check, 
  Edit3, 
  Eye,
  BookOpen
} from 'lucide-react';
import { FileItem } from '../drive/FileCard';

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (placeholderId: string, config: any) => any;
    };
  }
}

interface OfficeEditorModalProps {
  file: FileItem;
  onClose: () => void;
  onSaved?: () => void;
  onSwitchToPreview?: () => void;
}

export function isOfficeDocument(name: string, mimeType?: string): boolean {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const officeExts = [
    'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt',
    'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv',
    'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'ppsm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp'
  ];
  if (officeExts.includes(ext)) return true;
  if (mimeType && (
    mimeType.includes('word') || 
    mimeType.includes('sheet') || 
    mimeType.includes('presentation') || 
    mimeType.includes('opendocument') ||
    mimeType === 'text/plain' ||
    mimeType === 'text/csv'
  )) {
    return true;
  }
  return false;
}

export const OfficeEditorModal: React.FC<OfficeEditorModalProps> = ({
  file,
  onClose,
  onSaved,
  onSwitchToPreview,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<'word' | 'cell' | 'slide'>('word');
  const [canEdit, setCanEdit] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'ready'>('ready');

  const editorInstanceRef = useRef<any>(null);
  const containerId = `onlyoffice-editor-${file.id}`;

  useEffect(() => {
    let isMounted = true;

    const loadOnlyOffice = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/office/config/${file.id}`, { credentials: 'include' });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to initialize OnlyOffice configuration');
        }

        const data = await res.json();
        if (!isMounted) return;

        setDocType(data.documentType);
        setCanEdit(data.canEdit);

        const onlyofficeApiUrl = '/onlyoffice/web-apps/apps/api/documents/api.js';

        if (!window.DocsAPI) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = onlyofficeApiUrl;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('OnlyOffice Document Server is not reachable. You can view this document with the built-in reader.'));
            document.body.appendChild(script);
          });
        }

        if (!isMounted) return;

        const config = data.config;

        config.events = {
          onAppReady: () => {
            if (isMounted) setLoading(false);
          },
          onDocumentStateChange: (event: any) => {
            if (event.data) {
              setSaveStatus('saving');
            } else {
              setSaveStatus('saved');
              if (onSaved) onSaved();
            }
          },
          onError: (event: any) => {
            console.error('[OnlyOffice Error]', event);
            if (isMounted) setError(`OnlyOffice error: ${event.data || 'Failed to render document'}`);
          },
        };

        if (window.DocsAPI) {
          const containerEl = document.getElementById(containerId);
          if (containerEl) {
            containerEl.innerHTML = '';
          }

          editorInstanceRef.current = new window.DocsAPI.DocEditor(containerId, config);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('OnlyOffice loading error:', err);
          setError(err.message || 'Failed to load OnlyOffice editor');
          setLoading(false);
        }
      }
    };

    loadOnlyOffice();

    return () => {
      isMounted = false;
      if (editorInstanceRef.current && typeof editorInstanceRef.current.destroyEditor === 'function') {
        try {
          editorInstanceRef.current.destroyEditor();
        } catch {
          // Ignore
        }
      }
    };
  }, [file.id, containerId, onSaved]);

  const getDocTypeBadge = () => {
    switch (docType) {
      case 'word':
        return { icon: <FileText size={16} color="#0B57D0" />, label: 'Document', color: '#0B57D0' };
      case 'cell':
        return { icon: <FileSpreadsheet size={16} color="#137333" />, label: 'Spreadsheet', color: '#137333' };
      case 'slide':
        return { icon: <Presentation size={16} color="#E37400" />, label: 'Presentation', color: '#E37400' };
    }
  };

  const badge = getDocTypeBadge();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#F8FAFD',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Application Bar */}
      <header
        style={{
          height: '60px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E0E3E7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 10,
        }}
      >
        {/* Left: Document Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              background: `${badge.color}15`,
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            {badge.icon}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                color: '#1F1F1F',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '360px',
              }}
              title={file.name}
            >
              {file.name}
            </span>

            <span
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: canEdit ? '#E8F0FE' : '#E6F4EA',
                color: canEdit ? '#0B57D0' : '#137333',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
              }}
            >
              {canEdit ? <Edit3 size={11} /> : <Eye size={11} />}
              <span>{canEdit ? 'Editing' : 'Read-Only'}</span>
            </span>

            {canEdit && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: saveStatus === 'saved' ? '#137333' : '#5F6368',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {saveStatus === 'saved' && <Check size={13} />}
                {saveStatus === 'saving' && <Loader2 size={13} className="spin" />}
                <span>{saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : ''}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onSwitchToPreview && (
            <button
              onClick={onSwitchToPreview}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <BookOpen size={15} />
              <span>Document Reader</span>
            </button>
          )}

          <a
            href={`/api/files/${file.id}/download`}
            download={file.name}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Download</span>
          </a>

          <button
            onClick={onClose}
            title="Close Editor"
            style={{
              background: 'none',
              border: 'none',
              color: '#5F6368',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#F0F4F9' }}>
        {loading && !error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: '#1F1F1F',
              background: '#FFFFFF',
              zIndex: 5,
            }}
          >
            <Loader2 size={36} className="spin" color="#0B57D0" />
            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Loading Document Editor...</span>
            <span style={{ fontSize: '0.85rem', color: '#5F6368' }}>Opening {file.name}</span>
          </div>
        )}

        {/* Fallback / Error Card */}
        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              background: '#F8FAFD',
              zIndex: 6,
            }}
          >
            <div
              style={{
                maxWidth: '480px',
                width: '100%',
                padding: '32px',
                borderRadius: '16px',
                background: '#FFFFFF',
                border: '1px solid #E0E3E7',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div style={{ background: '#FCE8E6', padding: '14px', borderRadius: '50%' }}>
                <AlertTriangle size={32} color="#C5221F" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1F1F1F', margin: 0 }}>
                Could Not Load OnlyOffice Editor
              </h3>
              <p style={{ color: '#5F6368', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                {error}
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                {onSwitchToPreview && (
                  <button
                    onClick={onSwitchToPreview}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <BookOpen size={16} />
                    <span>Open in Document Reader</span>
                  </button>
                )}
                <a
                  href={`/api/files/${file.id}/download`}
                  download={file.name}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={16} />
                  <span>Download File</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Container for OnlyOffice DocEditor Iframe */}
        <div id={containerId} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
