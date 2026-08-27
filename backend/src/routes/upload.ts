import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { generateFileKey, wrapKey, unwrapKey, encryptBuffer } from '../utils/crypto.js';
import { logAudit } from '../services/audit.js';
import { addThumbnailJob } from '../queues/thumbnailQueue.js';

const router = Router();

// Ensure storage directories exist
const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');
const tempDir = path.join(storageBaseDir, 'temp');

fs.mkdirSync(filesDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

export function extractIndexableText(buffer: Buffer, filename: string, mimeType?: string): string | null {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const binaryExts = [
    'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'pdf',
    'zip', 'tar', 'gz', '7z', 'rar', 'bz2', 'iso',
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff',
    'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv',
    'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
    'exe', 'dll', 'so', 'dylib', 'bin', 'dmg', 'apk'
  ];

  if (binaryExts.includes(ext)) {
    return null;
  }

  const textExts = ['txt', 'md', 'json', 'csv', 'log', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'sql', 'xml', 'yml', 'yaml', 'sh', 'env', 'c', 'cpp', 'rs', 'go', 'java', 'ini', 'conf'];

  if (textExts.includes(ext) || (mimeType && (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml'))) {
    try {
      const text = buffer.toString('utf8', 0, Math.min(buffer.length, 100000));
      // Completely strip null bytes \0 / 0x00 and non-printable control chars so Postgres TEXT column never fails
      const sanitized = text.replace(/\0/g, '').replace(/\u0000/g, '').trim();
      return sanitized.length > 0 ? sanitized : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Memory storage for direct single-file uploads
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max for direct single-part upload; chunked for larger
});

// Binary parser middleware for chunk uploads
const rawBodyParser = (req: any, res: any, next: any) => {
  if (req.headers['content-type'] === 'application/octet-stream') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      req.body = Buffer.concat(chunks);
      next();
    });
  } else {
    next();
  }
};

// =============================================================================
// 1. Direct Single File Upload (Multipart Form-Data)
// =============================================================================
router.post(['/upload', '/upload/direct'], requireAuth, uploadMemory.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;
    const folderId = req.body.folderId && req.body.folderId !== 'root' ? req.body.folderId : null;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileSize = BigInt(file.size);

    // 1. Check storage quota
    const userResult = await pool.query(
      'SELECT "storageQuotaBytes", "storageUsedBytes" FROM "user" WHERE id = $1',
      [userId]
    );

    if (userResult.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const quota = BigInt(userResult.rows[0].storageQuotaBytes);
    const used = BigInt(userResult.rows[0].storageUsedBytes);

    if (used + fileSize > quota) {
      res.status(413).json({
        error: 'Storage quota exceeded',
        message: 'Uploading this file exceeds your allocated storage quota.',
      });
      return;
    }

    // 2. Generate per-file AES-256-GCM key and wrap with master key
    const fileKey = generateFileKey();
    const wrappedKey = wrapKey(fileKey);

    // 3. Encrypt file content with fileKey
    const encryptedData = encryptBuffer(file.buffer, fileKey);

    // 4. Save encrypted file to disk
    const fileId = uuidv4();
    const storageName = `${fileId}.enc`;
    const destPath = path.join(filesDir, storageName);
    await fs.promises.writeFile(destPath, encryptedData);

    const contentText = extractIndexableText(file.buffer, file.originalname, file.mimetype);

    // 5. Insert record into database & increment storageUsedBytes
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fileResult = await client.query(
        `INSERT INTO "files" (
          "id", "folder_id", "owner_id", "uuid_storage_name", "original_name",
          "mime_type", "size", "encryption_key_wrapped", "content_text"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, folder_id, original_name, mime_type, size, created_at, updated_at`,
        [
          fileId,
          folderId,
          userId,
          storageName,
          file.originalname,
          file.mimetype || 'application/octet-stream',
          file.size,
          wrappedKey,
          contentText,
        ]
      );

      await client.query(
        'UPDATE "user" SET "storageUsedBytes" = "storageUsedBytes" + $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
        [file.size, userId]
      );

      await client.query('COMMIT');

      // 6. Enqueue thumbnail generation for images/videos
      addThumbnailJob(fileId).catch((err) => {
        console.error('[Upload Direct] Error enqueuing thumbnail:', err);
      });

      // 7. Log Audit
      await logAudit({
        action: 'FILE_UPLOAD',
        userId,
        resourceId: fileId,
        resourceType: 'file',
        ipAddress: req.ip,
        details: { filename: file.originalname, size: file.size, folderId },
      });

      res.status(201).json({
        message: 'File uploaded successfully',
        file: fileResult.rows[0],
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      // Clean up orphaned encrypted file on disk
      await fs.promises.unlink(destPath).catch(() => {});
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Upload Direct] Error:', error);
    res.status(500).json({ error: error?.message || 'Failed to upload file' });
  }
});

// =============================================================================
// 2. Chunked / Resumable Upload — Step 1: Initialize Session
// =============================================================================
router.post('/upload/init', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { originalName, mimeType, totalSize, folderId } = req.body;

    if (!originalName || typeof totalSize !== 'number' || totalSize <= 0) {
      res.status(400).json({ error: 'Invalid file parameters. originalName and totalSize are required.' });
      return;
    }

    const requestedSize = BigInt(totalSize);

    // 1. Quota Enforcement
    const userResult = await pool.query(
      'SELECT "storageQuotaBytes", "storageUsedBytes" FROM "user" WHERE id = $1',
      [userId]
    );

    if (userResult.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const quota = BigInt(userResult.rows[0].storageQuotaBytes);
    const used = BigInt(userResult.rows[0].storageUsedBytes);

    if (used + requestedSize > quota) {
      res.status(413).json({
        error: 'Storage quota exceeded',
        message: 'Uploading this file exceeds your available storage quota.',
      });
      return;
    }

    // 2. Generate per-file key and wrap
    const fileKey = generateFileKey();
    const wrappedKey = wrapKey(fileKey);
    const uploadId = uuidv4();
    const storageName = `${uploadId}.enc`;

    // 3. Create temp file
    const tempFilePath = path.join(tempDir, `${uploadId}.tmp`);
    await fs.promises.writeFile(tempFilePath, Buffer.alloc(0));

    // 4. Save session in DB (valid for 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO "upload_sessions" (
        "id", "owner_id", "folder_id", "original_name", "mime_type",
        "total_size", "uploaded_size", "encryption_key_wrapped", "uuid_storage_name", "expires_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uploadId,
        userId,
        folderId || null,
        originalName,
        mimeType || 'application/octet-stream',
        totalSize,
        0,
        wrappedKey,
        storageName,
        expiresAt,
      ]
    );

    res.status(201).json({
      uploadId,
      chunkSize: 5 * 1024 * 1024, // 5 MB chunk recommendation
      totalSize,
      expiresAt,
    });
  } catch (error: any) {
    console.error('[Upload Init] Error:', error);
    res.status(500).json({ error: 'Failed to initialize upload session' });
  }
});

// =============================================================================
// 2. Chunked / Resumable Upload — Step 2: Upload Chunk
// =============================================================================
router.patch('/upload/:uploadId', requireAuth, rawBodyParser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { uploadId } = req.params;
    const chunkBuffer: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

    if (chunkBuffer.length === 0) {
      res.status(400).json({ error: 'Empty chunk data' });
      return;
    }

    // Verify session
    const sessionResult = await pool.query(
      'SELECT * FROM "upload_sessions" WHERE "id" = $1 AND "owner_id" = $2',
      [uploadId, userId]
    );

    if (sessionResult.rowCount === 0) {
      res.status(404).json({ error: 'Upload session not found or expired' });
      return;
    }

    const session = sessionResult.rows[0];
    const tempFilePath = path.join(tempDir, `${uploadId}.tmp`);

    // Append chunk to temp file
    await fs.promises.appendFile(tempFilePath, chunkBuffer);

    const newUploadedSize = Number(session.uploaded_size) + chunkBuffer.length;

    await pool.query(
      'UPDATE "upload_sessions" SET "uploaded_size" = $1 WHERE "id" = $2',
      [newUploadedSize, uploadId]
    );

    res.json({
      uploadId,
      uploadedSize: newUploadedSize,
      totalSize: Number(session.total_size),
      isComplete: newUploadedSize >= Number(session.total_size),
    });
  } catch (error: any) {
    console.error('[Upload Chunk] Error:', error);
    res.status(500).json({ error: 'Failed to write chunk' });
  }
});

// =============================================================================
// 2. Chunked / Resumable Upload — Step 3: Finalize & Encrypt to Storage
// =============================================================================
router.post('/upload/:uploadId/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { uploadId } = req.params;

    const sessionResult = await pool.query(
      'SELECT * FROM "upload_sessions" WHERE "id" = $1 AND "owner_id" = $2',
      [uploadId, userId]
    );

    if (sessionResult.rowCount === 0) {
      res.status(404).json({ error: 'Upload session not found' });
      return;
    }

    const session = sessionResult.rows[0];
    const tempFilePath = path.join(tempDir, `${uploadId}.tmp`);

    if (!fs.existsSync(tempFilePath)) {
      res.status(400).json({ error: 'Temp upload file missing' });
      return;
    }

    // 1. Read assembled unencrypted data
    const rawBuffer = await fs.promises.readFile(tempFilePath);
    const actualSize = rawBuffer.length;

    // 2. Unwrap per-file key
    const fileKey = unwrapKey(session.encryption_key_wrapped);

    // 3. Encrypt data with AES-256-GCM
    const encryptedData = encryptBuffer(rawBuffer, fileKey);

    // 4. Save to final storage destination
    const fileId = uuidv4();
    const storageName = `${fileId}.enc`;
    const destPath = path.join(filesDir, storageName);
    await fs.promises.writeFile(destPath, encryptedData);

    const contentText = extractIndexableText(rawBuffer, session.original_name, session.mime_type);

    // 5. Clean up temporary unencrypted assembly file
    await fs.promises.unlink(tempFilePath).catch(() => {});

    // 6. Insert file and update quota in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fileResult = await client.query(
        `INSERT INTO "files" (
          "id", "folder_id", "owner_id", "uuid_storage_name", "original_name",
          "mime_type", "size", "encryption_key_wrapped", "content_text"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, folder_id, original_name, mime_type, size, created_at, updated_at`,
        [
          fileId,
          session.folder_id,
          userId,
          storageName,
          session.original_name,
          session.mime_type,
          actualSize,
          session.encryption_key_wrapped,
          contentText,
        ]
      );

      await client.query(
        'UPDATE "user" SET "storageUsedBytes" = "storageUsedBytes" + $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
        [actualSize, userId]
      );

      await client.query('DELETE FROM "upload_sessions" WHERE id = $1', [uploadId]);

      await client.query('COMMIT');

      // 7. Enqueue thumbnail generation for images/videos
      addThumbnailJob(fileId).catch((err) => {
        console.error('[Upload Complete] Error enqueuing thumbnail:', err);
      });

      // 8. Audit log
      await logAudit({
        action: 'FILE_UPLOAD',
        userId,
        resourceId: fileId,
        resourceType: 'file',
        ipAddress: req.ip,
        details: { filename: session.original_name, size: actualSize, folderId: session.folder_id },
      });

      res.status(201).json({
        message: 'File upload completed and encrypted successfully',
        file: fileResult.rows[0],
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      await fs.promises.unlink(destPath).catch(() => {});
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Upload Complete] Error:', error);
    res.status(500).json({ error: 'Failed to complete file upload' });
  }
});

export default router;
