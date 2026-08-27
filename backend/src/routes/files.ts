import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { unwrapKey, decryptFileFromDisk, encryptBuffer } from '../utils/crypto.js';
import { logAudit } from '../services/audit.js';
import { generateThumbnail } from '../services/thumbnail.js';

const router = Router();

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');
const thumbnailsDir = path.join(storageBaseDir, 'thumbnails');

fs.mkdirSync(thumbnailsDir, { recursive: true });

// =============================================================================
// 1. List Files in Folder or Root
// =============================================================================
router.get('/files', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderIdParam = req.query.folderId as string | undefined;
    const folderId = folderIdParam && folderIdParam !== 'root' ? folderIdParam : null;

    const fileQuery = folderId
      ? `SELECT f.id, f.folder_id, f.original_name, f.mime_type, f.size, f.thumbnail_path, f.is_starred, f.created_at, f.updated_at,
                EXISTS(SELECT 1 FROM "shares" s WHERE s.resource_id = f.id) as is_shared
         FROM "files" f
         WHERE f.owner_id = $1 AND f.folder_id = $2 AND f.deleted_at IS NULL
         ORDER BY f.original_name ASC`
      : `SELECT f.id, f.folder_id, f.original_name, f.mime_type, f.size, f.thumbnail_path, f.is_starred, f.created_at, f.updated_at,
                EXISTS(SELECT 1 FROM "shares" s WHERE s.resource_id = f.id) as is_shared
         FROM "files" f
         WHERE f.owner_id = $1 AND f.folder_id IS NULL AND f.deleted_at IS NULL
         ORDER BY f.original_name ASC`;

    const params = folderId ? [userId, folderId] : [userId];
    const result = await pool.query(fileQuery, params);

    const files = result.rows.map((f) => ({
      id: f.id,
      folderId: f.folder_id,
      name: f.original_name,
      mimeType: f.mime_type,
      size: Number(f.size),
      sizeFormatted: formatBytes(Number(f.size)),
      thumbnailPath: f.thumbnail_path,
      isStarred: Boolean(f.is_starred),
      isShared: Boolean(f.is_shared),
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({ files });
  } catch (error: any) {
    console.error('[Get Files] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

// Helper to query file with owner or recipient authorization
const getAccessibleFile = async (fileId: string, userId: string) => {
  return pool.query(
    `SELECT DISTINCT f.id, f.original_name, f.mime_type, f.size, f.uuid_storage_name, f.encryption_key_wrapped, f.thumbnail_path
     FROM "files" f
     LEFT JOIN "shares" s ON s.resource_id = f.id
     LEFT JOIN "share_recipients" sr ON sr.share_id = s.id AND sr.user_id = $2
     WHERE f.id = $1 AND f.deleted_at IS NULL AND (
       f.owner_id = $2 OR 
       (sr.user_id = $2 AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP))
     )
     LIMIT 1`,
    [fileId, userId]
  );
};

// =============================================================================
// 2. Download File (On-The-Fly Decryption)
// =============================================================================
router.get('/files/:fileId/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    const fileRes = await getAccessibleFile(fileId, userId);

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileRes.rows[0];
    const encryptedFilePath = path.join(filesDir, file.uuid_storage_name);

    if (!fs.existsSync(encryptedFilePath)) {
      res.status(404).json({ error: 'Encrypted storage file not found on disk' });
      return;
    }

    // 1. Unwrap file encryption key
    const fileKey = unwrapKey(file.encryption_key_wrapped);

    // 2. Decrypt on-the-fly
    const decryptedBuffer = await decryptFileFromDisk(encryptedFilePath, fileKey);

    // 3. Set download headers
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    // 4. Log audit event
    await logAudit({
      action: 'FILE_DOWNLOAD',
      userId,
      resourceId: fileId,
      resourceType: 'file',
      ipAddress: req.ip,
      details: { filename: file.original_name, size: Number(file.size) },
    });

    res.send(decryptedBuffer);
  } catch (error: any) {
    console.error('[Download File] Error:', error);
    res.status(500).json({ error: 'Failed to download and decrypt file' });
  }
});

// =============================================================================
// 3. Stream File Preview (Inline Decryption for Video/Audio/Image/PDF)
// =============================================================================
router.get('/files/:fileId/preview', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    const fileRes = await getAccessibleFile(fileId, userId);

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileRes.rows[0];
    const encryptedFilePath = path.join(filesDir, file.uuid_storage_name);

    if (!fs.existsSync(encryptedFilePath)) {
      res.status(404).json({ error: 'Encrypted storage file not found' });
      return;
    }

    const fileKey = unwrapKey(file.encryption_key_wrapped);
    const decryptedBuffer = await decryptFileFromDisk(encryptedFilePath, fileKey);

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    res.send(decryptedBuffer);
  } catch (error: any) {
    console.error('[Preview File] Error:', error);
    res.status(500).json({ error: 'Failed to preview file' });
  }
});

// =============================================================================
// 4. Serve File Thumbnail (WebP 300x300 preview)
// =============================================================================
const handleThumbnailRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    const fileRes = await getAccessibleFile(fileId, userId);

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileRes.rows[0];
    let thumbnailFilename = file.thumbnail_path || `${fileId}.webp`;
    let thumbnailDiskPath = path.join(thumbnailsDir, path.basename(thumbnailFilename));

    // If thumbnail doesn't exist on disk, attempt on-demand generation
    if (!fs.existsSync(thumbnailDiskPath)) {
      const generated = await generateThumbnail(fileId);
      if (!generated) {
        res.status(404).json({ error: 'Thumbnail not available for this file type' });
        return;
      }
      thumbnailDiskPath = path.join(thumbnailsDir, path.basename(generated));
    }

    if (!fs.existsSync(thumbnailDiskPath)) {
      res.status(404).json({ error: 'Thumbnail file missing' });
      return;
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    
    const fileStream = fs.createReadStream(thumbnailDiskPath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('[Thumbnail Serve] Error:', error);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
};

router.get('/files/:fileId/thumbnail', requireAuth, handleThumbnailRequest);
router.get('/thumbnail/:fileId', requireAuth, handleThumbnailRequest);

// =============================================================================
// 5. Rename or Move File
// =============================================================================
router.patch('/files/:fileId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;
    const { name, folderId: rawFolderId } = req.body;

    const fileRes = await pool.query(
      'SELECT id, folder_id, original_name FROM "files" WHERE id = $1 AND owner_id = $2',
      [fileId, userId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const currentFile = fileRes.rows[0];
    const newName = name !== undefined ? name.trim() : currentFile.original_name;
    const newFolderId = rawFolderId !== undefined
      ? (rawFolderId === 'root' ? null : rawFolderId)
      : currentFile.folder_id;

    // If folderId provided, verify it exists
    if (newFolderId) {
      const folderCheck = await pool.query(
        'SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2',
        [newFolderId, userId]
      );
      if (folderCheck.rowCount === 0) {
        res.status(404).json({ error: 'Target folder not found' });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE "files"
       SET "original_name" = $1, "folder_id" = $2, "updated_at" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "owner_id" = $4
       RETURNING id, folder_id, original_name, mime_type, size, thumbnail_path, created_at, updated_at`,
      [newName, newFolderId, fileId, userId]
    );

    if (name !== undefined && name !== currentFile.original_name) {
      await logAudit({
        action: 'FILE_RENAME',
        userId,
        resourceId: fileId,
        resourceType: 'file',
        ipAddress: req.ip,
        details: { oldName: currentFile.original_name, newName },
      });
    }

    if (rawFolderId !== undefined && newFolderId !== currentFile.folder_id) {
      await logAudit({
        action: 'FILE_MOVE',
        userId,
        resourceId: fileId,
        resourceType: 'file',
        ipAddress: req.ip,
        details: { oldFolderId: currentFile.folder_id, newFolderId },
      });
    }

    res.json({
      message: 'File updated successfully',
      file: result.rows[0],
    });
  } catch (error: any) {
    console.error('[Update File] Error:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// =============================================================================
// 5b. Save / Update File Document Content (Direct Document Editing)
// =============================================================================
router.put('/files/:fileId/content', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;
    const { content } = req.body;

    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Content must be a string' });
      return;
    }

    const fileRes = await pool.query(
      'SELECT id, original_name, mime_type, size, uuid_storage_name, encryption_key_wrapped FROM "files" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [fileId, userId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = fileRes.rows[0];
    const previousSize = Number(file.size);
    const contentBuffer = Buffer.from(content, 'utf8');
    const newSize = contentBuffer.length;
    const sizeDelta = BigInt(newSize - previousSize);

    // 1. Quota Check
    const userRes = await pool.query(
      'SELECT "storageQuotaBytes", "storageUsedBytes" FROM "user" WHERE id = $1',
      [userId]
    );
    const quota = BigInt(userRes.rows[0].storageQuotaBytes);
    const used = BigInt(userRes.rows[0].storageUsedBytes);

    if (used + sizeDelta > quota) {
      res.status(413).json({ error: 'Storage quota exceeded' });
      return;
    }

    // 2. Encrypt updated content with the file key
    const fileKey = unwrapKey(file.encryption_key_wrapped);
    const encryptedData = encryptBuffer(contentBuffer, fileKey);

    // 3. Save version history snapshot before updating main file
    const currentEncryptedPath = path.join(filesDir, file.uuid_storage_name);
    const versionStorageName = `${fileId}_v_${Date.now()}.enc`;
    const versionEncryptedPath = path.join(filesDir, versionStorageName);

    let createdVersion = false;
    if (fs.existsSync(currentEncryptedPath)) {
      await fs.promises.copyFile(currentEncryptedPath, versionEncryptedPath);
      createdVersion = true;
    }

    // 4. Write updated content to disk
    await fs.promises.writeFile(currentEncryptedPath, encryptedData);

    // 5. Update database record & update storage usage
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (createdVersion) {
        const maxVerRes = await client.query(
          'SELECT COALESCE(MAX(version_number), 0) as max_ver FROM "file_versions" WHERE file_id = $1',
          [fileId]
        );
        const nextVerNumber = parseInt(maxVerRes.rows[0].max_ver, 10) + 1;

        await client.query(
          `INSERT INTO "file_versions" (id, file_id, version_number, size, uuid_storage_name, encryption_key_wrapped, created_by, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            fileId,
            nextVerNumber,
            previousSize,
            versionStorageName,
            file.encryption_key_wrapped,
            userId,
          ]
        );
      }

      await client.query(
        'UPDATE "files" SET "size" = $1, "content_text" = $2, "updated_at" = CURRENT_TIMESTAMP WHERE id = $3',
        [newSize, content, fileId]
      );

      await client.query(
        'UPDATE "user" SET "storageUsedBytes" = "storageUsedBytes" + $1 WHERE id = $2',
        [sizeDelta.toString(), userId]
      );

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    await logAudit({
      action: 'FILE_EDIT',
      userId,
      resourceId: fileId,
      resourceType: 'file',
      ipAddress: req.ip,
      details: { filename: file.original_name, newSize },
    });

    res.json({
      message: 'Document saved successfully',
      fileId,
      size: newSize,
      sizeFormatted: formatBytes(newSize),
    });
  } catch (error: any) {
    console.error('[Save Content] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to save document content' });
  }
});

// =============================================================================
// 6. Delete File (Soft Delete -> Moves to Trash)
// =============================================================================
router.delete('/files/:fileId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    const fileRes = await pool.query(
      'SELECT id, original_name, size FROM "files" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [fileId, userId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = fileRes.rows[0];

    // Soft delete by setting deleted_at timestamp
    await pool.query(
      'UPDATE "files" SET "deleted_at" = CURRENT_TIMESTAMP WHERE id = $1 AND owner_id = $2',
      [fileId, userId]
    );

    await logAudit({
      action: 'FILE_DELETE',
      userId,
      resourceId: fileId,
      resourceType: 'file',
      ipAddress: req.ip,
      details: { filename: file.original_name, size: Number(file.size), softDelete: true },
    });

    res.json({ message: 'File moved to Trash', fileId });
  } catch (error: any) {
    console.error('[Delete File] Error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default router;
