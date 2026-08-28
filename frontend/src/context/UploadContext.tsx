import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  sizeFormatted: string;
  progress: number; // 0 to 100
  status: 'queued' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  folderId: string | null;
  uploadedBytes: number;
  uploadId?: string;
  speed?: number;
  remainingTime?: number;
}

interface UploadContextType {
  uploads: UploadItem[];
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
  uploadFiles: (files: FileList | File[], folderId: string | null) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  onUploadSuccessCallback: (() => void) | null;
  setOnUploadSuccessCallback: (cb: () => void) => void;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { refreshUser } = useAuth();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const onUploadSuccessRef = useRef<(() => void) | null>(null);
  const activeUploadsRef = useRef<Map<string, { abort: () => void }>>(new Map());

  const setOnUploadSuccessCallback = useCallback((cb: () => void) => {
    onUploadSuccessRef.current = cb;
  }, []);

  const updateUploadItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const processUpload = useCallback(async (item: UploadItem) => {
    updateUploadItem(item.id, { status: 'uploading', progress: 0, error: undefined });

    const file = item.file;
    const folderId = item.folderId;
    const abortController = new AbortController();
    const startTime = Date.now();

    try {
      // 1. If file is small (< 5MB), use direct upload
      if (file.size <= CHUNK_SIZE) {
        const formData = new FormData();
        formData.append('file', file);
        if (folderId && folderId !== 'root') {
          formData.append('folderId', folderId);
        }

        const xhr = new XMLHttpRequest();
        activeUploadsRef.current.set(item.id, { abort: () => xhr.abort() });

        xhr.open('POST', '/api/upload/direct', true);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            const speed = elapsed > 0 ? e.loaded / elapsed : 0;
            const remainingBytes = e.total - e.loaded;
            const remainingTime = speed > 0 ? remainingBytes / speed : 0;
            
            const percent = Math.round((e.loaded / e.total) * 100);
            updateUploadItem(item.id, { progress: percent, uploadedBytes: e.loaded, speed, remainingTime });
          }
        };

        await new Promise<void>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateUploadItem(item.id, { status: 'completed', progress: 100, uploadedBytes: file.size });
              resolve();
            } else {
              try {
                const errJson = JSON.parse(xhr.responseText);
                reject(new Error(errJson.error || errJson.message || 'Direct upload failed'));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          };
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.onabort = () => reject(new Error('Upload cancelled'));
          xhr.send(formData);
        });
      } else {
        // 2. Resumable Chunked Upload for files > 5MB
        activeUploadsRef.current.set(item.id, { abort: () => abortController.abort() });

        // Step A: Init session
        const initRes = await fetch('/api/upload/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            totalSize: file.size,
            folderId: folderId && folderId !== 'root' ? folderId : null,
          }),
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!initRes.ok) {
          const errData = await initRes.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || 'Failed to initialize chunked upload');
        }

        const { uploadId } = await initRes.json();
        updateUploadItem(item.id, { uploadId });

        let dynamicChunkSize = CHUNK_SIZE; // 5MB default
        let maxConcurrent = 4; // Fast default concurrency

        const navConn = (navigator as any).connection;
        if (navConn) {
          if (['slow-2g', '2g', '3g'].includes(navConn.effectiveType)) {
            dynamicChunkSize = 1024 * 1024; // 1 MB
            maxConcurrent = 1; // Sequential to prevent timeouts
          }
        }

        // Step B: Prepare chunks
        const chunks: { offset: number; size: number }[] = [];
        for (let offset = 0; offset < file.size; offset += dynamicChunkSize) {
          chunks.push({ offset, size: Math.min(dynamicChunkSize, file.size - offset) });
        }

        let uploadedBytesGlobal = 0;

        const uploadChunk = async (chunkDef: { offset: number; size: number }) => {
          if (abortController.signal.aborted) {
            throw new Error('Upload cancelled');
          }

          const chunk = file.slice(chunkDef.offset, chunkDef.offset + chunkDef.size);
          const chunkBuffer = await chunk.arrayBuffer();

          const chunkRes = await fetch(`/api/upload/${uploadId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Upload-Offset': chunkDef.offset.toString(),
            },
            body: chunkBuffer,
            credentials: 'include',
            signal: abortController.signal,
          });

          if (!chunkRes.ok) {
            const chunkErr = await chunkRes.json().catch(() => ({}));
            throw new Error(chunkErr.error || 'Failed uploading chunk');
          }

          uploadedBytesGlobal += chunkDef.size;
          
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? uploadedBytesGlobal / elapsed : 0;
          const remainingBytes = file.size - uploadedBytesGlobal;
          const remainingTime = speed > 0 ? remainingBytes / speed : 0;

          const percent = Math.min(99, Math.round((uploadedBytesGlobal / file.size) * 100));
          updateUploadItem(item.id, { progress: percent, uploadedBytes: uploadedBytesGlobal, speed, remainingTime });
        };

        // Concurrency pool runner
        const executing = new Set<Promise<void>>();
        let hasError = false;
        let firstError: any = null;

        for (const chunkDef of chunks) {
          if (abortController.signal.aborted) throw new Error('Upload cancelled');
          if (hasError) break; // Stop queuing new chunks if an error occurred
          
          const p = Promise.resolve().then(() => uploadChunk(chunkDef));
          executing.add(p);
          
          const clean = () => executing.delete(p);
          p.then(clean).catch((err) => { 
            hasError = true; 
            firstError = err; 
            clean(); 
          });
          
          if (executing.size >= maxConcurrent) {
            await Promise.race(executing);
          }
        }
        await Promise.all(executing);

        if (hasError) {
          throw firstError || new Error('Upload failed during chunking');
        }

        // Step C: Complete & finalize assembly + encryption
        const completeRes = await fetch(`/api/upload/${uploadId}/complete`, {
          method: 'POST',
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!completeRes.ok) {
          const compErr = await completeRes.json().catch(() => ({}));
          throw new Error(compErr.error || 'Failed finalizing upload');
        }

        updateUploadItem(item.id, { status: 'completed', progress: 100, uploadedBytes: file.size });
      }

      // Notify caller and refresh storage quota
      await refreshUser();
      if (onUploadSuccessRef.current) {
        onUploadSuccessRef.current();
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Upload cancelled') {
        updateUploadItem(item.id, { status: 'cancelled', error: 'Upload cancelled by user' });
      } else {
        console.error('[Upload] Error:', err);
        updateUploadItem(item.id, {
          status: 'error',
          error: err?.message || 'Upload failed',
        });
      }
    } finally {
      activeUploadsRef.current.delete(item.id);
    }
  }, [updateUploadItem, refreshUser]);

  const uploadFiles = useCallback((fileList: FileList | File[], folderId: string | null) => {
    const newItems: UploadItem[] = Array.from(fileList).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: f,
      name: f.name,
      size: f.size,
      sizeFormatted: formatBytes(f.size),
      progress: 0,
      status: 'queued',
      folderId,
      uploadedBytes: 0,
    }));

    setUploads((prev) => [...newItems, ...prev]);
    setIsDrawerOpen(true);
    setIsMinimized(false);

    // Process sequentially or concurrently
    newItems.forEach((item) => {
      processUpload(item);
    });
  }, [processUpload]);

  const retryUpload = useCallback((id: string) => {
    const item = uploads.find((u) => u.id === id);
    if (item) {
      processUpload(item);
    }
  }, [uploads, processUpload]);

  const cancelUpload = useCallback((id: string) => {
    const active = activeUploadsRef.current.get(id);
    if (active) {
      active.abort();
      activeUploadsRef.current.delete(id);
    }
    updateUploadItem(id, { status: 'cancelled', error: 'Upload cancelled by user' });
  }, [updateUploadItem]);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'completed'));
  }, []);

  return (
    <UploadContext.Provider
      value={{
        uploads,
        isDrawerOpen,
        setIsDrawerOpen,
        isMinimized,
        setIsMinimized,
        uploadFiles,
        retryUpload,
        cancelUpload,
        clearCompleted,
        onUploadSuccessCallback: onUploadSuccessRef.current,
        setOnUploadSuccessCallback,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
};

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
