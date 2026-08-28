import React from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  FileText, 
  Loader2,
  Trash2
} from 'lucide-react';
import { useUpload } from '../../context/UploadContext';

export const UploadDrawer: React.FC = () => {
  const { 
    uploads, 
    isDrawerOpen, 
    setIsDrawerOpen, 
    isMinimized, 
    setIsMinimized, 
    retryUpload, 
    cancelUpload, 
    clearCompleted 
  } = useUpload();

  if (!isDrawerOpen || uploads.length === 0) return null;

  const activeCount = uploads.filter((u) => u.status === 'uploading' || u.status === 'queued').length;
  const completedCount = uploads.filter((u) => u.status === 'completed').length;
  const errorCount = uploads.filter((u) => u.status === 'error').length;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        width: '400px',
        maxWidth: 'calc(100vw - 3rem)',
        zIndex: 1200,
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #E0E3E7',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#F8FAFD',
          borderBottom: isMinimized ? 'none' : '1px solid #E0E3E7',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeCount > 0 ? (
            <Loader2 size={18} className="spin" color="#0B57D0" />
          ) : errorCount > 0 ? (
            <AlertCircle size={18} color="#C5221F" />
          ) : (
            <CheckCircle2 size={18} color="#137333" />
          )}
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1F1F1F' }}>
            {activeCount > 0
              ? `Uploading ${activeCount} file${activeCount > 1 ? 's' : ''}...`
              : errorCount > 0
              ? `${errorCount} upload${errorCount > 1 ? 's' : ''} failed`
              : 'Uploads Completed'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {completedCount > 0 && !isMinimized && (
            <button
              onClick={clearCompleted}
              title="Clear completed"
              style={{
                background: 'none',
                border: 'none',
                color: '#5F6368',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                borderRadius: '50%',
              }}
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
            style={{
              background: 'none',
              border: 'none',
              color: '#5F6368',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              borderRadius: '50%',
            }}
          >
            {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <button
            onClick={() => setIsDrawerOpen(false)}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: '#5F6368',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              borderRadius: '50%',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Drawer Item List */}
      {!isMinimized && (
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {uploads.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #F1F3F4',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <FileText size={18} color="#0B57D0" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      title={item.name}
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: '#1F1F1F',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#5F6368', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{item.sizeFormatted}</span>
                      {item.status === 'uploading' && item.remainingTime !== undefined && (
                        <>
                          <span>•</span>
                          <span>{item.progress}%</span>
                          <span>•</span>
                          <span>
                            {!isFinite(item.remainingTime) || item.remainingTime < 0 
                              ? 'calculating...' 
                              : item.remainingTime < 60 
                                ? `${Math.ceil(item.remainingTime)}s left` 
                                : item.remainingTime < 3600
                                  ? `${Math.floor(item.remainingTime / 60)}m ${Math.ceil(item.remainingTime % 60)}s left`
                                  : `${Math.floor(item.remainingTime / 3600)}h ${Math.floor((item.remainingTime % 3600) / 60)}m left`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Indicator / Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {item.status === 'completed' && (
                    <CheckCircle2 size={16} color="#137333" />
                  )}

                  {item.status === 'error' && (
                    <>
                      <button
                        onClick={() => retryUpload(item.id)}
                        title="Retry"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0B57D0',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                        }}
                      >
                        <RotateCw size={15} />
                      </button>
                      <button
                        onClick={() => cancelUpload(item.id)}
                        title="Dismiss"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#5F6368',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                        }}
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}

                  {item.status === 'uploading' && (
                    <button
                      onClick={() => cancelUpload(item.id)}
                      title="Cancel"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#5F6368',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {item.status === 'uploading' && (
                <div style={{ width: '100%', height: '4px', background: '#E0E3E7', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.progress}%`,
                      height: '100%',
                      background: '#0B57D0',
                      borderRadius: '2px',
                      transition: 'width 0.2s linear',
                    }}
                  />
                </div>
              )}

              {/* Error message */}
              {item.status === 'error' && item.error && (
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: '#C5221F',
                    background: '#FCE8E6',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginTop: '2px',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
