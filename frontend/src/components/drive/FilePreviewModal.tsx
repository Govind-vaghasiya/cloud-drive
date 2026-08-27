import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Loader2, 
  AlertCircle, 
  Maximize2, 
  Minimize2, 
  Edit3, 
  Check, 
  Save, 
  Eye 
} from 'lucide-react';
import mammoth from 'mammoth';
import { isOfficeDocument } from '../office/OfficeEditorModal';
import { getFileColor } from './FileCard';

interface FilePreviewModalProps {
  file: {
    id: string;
    name: string;
    mimeType: string;
    sizeFormatted: string;
  };
  onClose: () => void;
  onDownload: () => void;
  onOpenOffice?: () => void;
  onSaved?: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ 
  file, 
  onClose, 
  onDownload, 
  onOpenOffice,
  onSaved
}) => {
  const [textContent, setTextContent] = useState<string>('');
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const isOffice = isOfficeDocument(file.name, file.mimeType);
  const previewUrl = `/api/files/${file.id}/preview`;
  const isImage = file.mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name);
  const isVideo = file.mimeType.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv)$/i.test(file.name);
  const isAudio = file.mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
  const isPdf = file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx = /\.(docx|dotx|docm)$/i.test(file.name) || file.mimeType.includes('wordprocessingml');
  const isTextOrCode = !isDocx && (file.mimeType.startsWith('text/') || /\.(txt|json|js|ts|tsx|jsx|html|css|md|py|go|rs|c|cpp|java|sh|yml|yaml|sql|xml|env|log|csv)$/i.test(file.name));
  const isEditable = isDocx || isTextOrCode;

  useEffect(() => {
    if (isDocx) {
      setLoadingContent(true);
      setError(null);
      fetch(`/api/files/${file.id}/download`, { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to load Word document');
          return res.arrayBuffer();
        })
        .then(async (arrayBuffer) => {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          const html = result.value || '<p><em>Empty Document</em></p>';
          setDocxHtml(html);
        })
        .catch((err) => setError(err.message || 'Could not parse Word document'))
        .finally(() => setLoadingContent(false));
    } else if (isTextOrCode) {
      setLoadingContent(true);
      setError(null);
      fetch(previewUrl, { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch text content');
          return res.text();
        })
        .then((txt) => setTextContent(txt))
        .catch((err) => setError(err.message))
        .finally(() => setLoadingContent(false));
    }
  }, [file.id, isDocx, isTextOrCode, previewUrl]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    let updatedContent = '';
    if (isDocx) {
      updatedContent = editorRef.current ? editorRef.current.innerText : docxHtml;
    } else {
      updatedContent = textContent;
    }

    try {
      const res = await fetch(`/api/files/${file.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: updatedContent }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save document');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(err.message || 'Error saving changes');
    } finally {
      setIsSaving(false);
    }
  };

  const fileColor = getFileColor(file.mimeType, file.name);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: isFullscreen ? '0' : '1.5rem',
        transition: 'padding 0.2s',
      }}
    >
      {/* Modal Card */}
      <div
        style={{
          width: isFullscreen ? '100vw' : '92vw',
          height: isFullscreen ? '100vh' : '90vh',
          maxWidth: isFullscreen ? '100vw' : '1280px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isFullscreen ? '0' : '16px',
          overflow: 'hidden',
          background: '#FFFFFF',
          border: isFullscreen ? 'none' : '1px solid #E0E3E7',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: '#FFFFFF',
            borderBottom: '1px solid #E0E3E7',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <FileText size={22} color={fileColor} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: '#1F1F1F',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{file.name}</span>
                {isEditing && (
                  <span style={{ fontSize: '0.72rem', background: '#E8F0FE', color: '#0B57D0', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    Editing
                  </span>
                )}
                {saveSuccess && (
                  <span style={{ fontSize: '0.72rem', background: '#E6F4EA', color: '#137333', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Check size={11} /> Saved
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#5F6368' }}>
                {file.sizeFormatted} · {file.mimeType}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Edit / View Toggle */}
            {isEditable && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  background: isEditing ? '#E8F0FE' : '#FFFFFF',
                  color: isEditing ? '#0B57D0' : '#5F6368',
                  borderColor: isEditing ? '#0B57D0' : '#E0E3E7',
                }}
              >
                {isEditing ? <Eye size={15} /> : <Edit3 size={15} />}
                <span>{isEditing ? 'View Mode' : 'Edit Document'}</span>
              </button>
            )}

            {/* Save Button */}
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                {isSaving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            )}

            {isOffice && onOpenOffice && (
              <button
                onClick={() => { onClose(); onOpenOffice(); }}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                title="Open in OnlyOffice Server"
              >
                <Edit3 size={15} />
                <span>OnlyOffice</span>
              </button>
            )}

            <button
              onClick={onDownload}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
            >
              <Download size={15} />
              <span>Download</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              style={{
                background: 'none',
                border: '1px solid #E0E3E7',
                color: '#5F6368',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              onClick={onClose}
              title="Close Preview"
              style={{
                background: 'none',
                border: '1px solid #E0E3E7',
                color: '#5F6368',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Viewer / Editor Body */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            padding: '1.5rem',
            background: '#F0F4F9',
          }}
        >
          {isImage ? (
            <img
              src={previewUrl}
              alt={file.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              }}
            />
          ) : isVideo ? (
            <video
              controls
              autoPlay
              src={previewUrl}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              }}
            />
          ) : isAudio ? (
            <div style={{ padding: '3rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E0E3E7', textAlign: 'center' }}>
              <audio controls autoPlay src={previewUrl} style={{ width: '380px' }} />
            </div>
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              title={file.name}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '8px',
                background: '#FFFFFF',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              }}
            />
          ) : isDocx ? (
            loadingContent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5F6368' }}>
                <Loader2 size={24} className="spin" color="#0B57D0" />
                <span>Loading Word Document...</span>
              </div>
            ) : error ? (
              <div style={{ background: '#FCE8E6', color: '#C5221F', padding: '14px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            ) : (
              /* Google Docs Sheet Layout with In-Browser Editing */
              <div
                style={{
                  width: '100%',
                  maxWidth: '850px',
                  minHeight: '100%',
                  background: '#FFFFFF',
                  padding: '48px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
                  color: '#1F1F1F',
                  fontFamily: 'Roboto, Arial, sans-serif',
                  lineHeight: 1.6,
                  overflowY: 'auto',
                  outline: isEditing ? '2px solid #0B57D0' : 'none',
                  cursor: isEditing ? 'text' : 'default',
                }}
                ref={editorRef}
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            )
          ) : isTextOrCode ? (
            loadingContent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5F6368' }}>
                <Loader2 size={24} className="spin" color="#0B57D0" />
                <span>Loading text content...</span>
              </div>
            ) : error ? (
              <div style={{ background: '#FCE8E6', color: '#C5221F', padding: '14px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            ) : isEditing ? (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  margin: 0,
                  padding: '1.5rem',
                  background: '#FFFFFF',
                  color: '#1F1F1F',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  border: '2px solid #0B57D0',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'none',
                }}
              />
            ) : (
              <pre
                style={{
                  width: '100%',
                  height: '100%',
                  margin: 0,
                  padding: '1.5rem',
                  background: '#FFFFFF',
                  color: '#1F1F1F',
                  fontFamily: 'monospace',
                  fontSize: '0.88rem',
                  overflow: 'auto',
                  borderRadius: '8px',
                  border: '1px solid #E0E3E7',
                  lineHeight: 1.5,
                }}
              >
                {textContent}
              </pre>
            )
          ) : (
            /* Fallback for unpreviewable formats */
            <div style={{ textAlign: 'center', padding: '3rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E0E3E7', maxWidth: '440px' }}>
              <FileText size={56} color={fileColor} style={{ margin: '0 auto 1rem' }} />
              <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1F1F1F', margin: '0 0 6px 0' }}>
                No direct preview available
              </h4>
              <p style={{ color: '#5F6368', fontSize: '0.85rem', margin: '0 0 20px 0' }}>
                This file format ({file.mimeType}) cannot be directly rendered in the browser. You can download the decrypted file.
              </p>
              <button
                onClick={onDownload}
                className="btn btn-primary"
                style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={18} />
                <span>Download File</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
