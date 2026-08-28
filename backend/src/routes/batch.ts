// Batch operations router for Move, Delete, and Copy
import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = Router();
const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');
const thumbnailsDir = path.join(storageBaseDir, 'thumbnails');

// Ensure directories exist
fs.mkdirSync(filesDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });

// Helper to copy a file directly and return its size in bytes
async function copyFileDirect(client: any, srcFileId: string, destParentId: string | null, userId: string): Promise<bigint> {
  const fileRes = await client.query(
    `SELECT id, uuid_storage_name, original_name, mime_type, size, encryption_key_wrapped, thumbnail_path, content_text 
     FROM "files" 
     WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [srcFileId, userId]
  );
  if (fileRes.rowCount === 0) throw new Error('File not found');
  const file = fileRes.rows[0];

  const newFileId = uuidv4();
  const newStorageName = `${newFileId}.enc`;
  const srcPath = path.join(filesDir, file.uuid_storage_name);
  const destPath = path.join(filesDir, newStorageName);

  await fs.promises.copyFile(srcPath, destPath);

  // Copy thumbnail if it exists
  let newThumbnailPath = null;
  if (file.thumbnail_path) {
    const originalThumbnailName = file.thumbnail_path;
    const extension = path.extname(originalThumbnailName) || '.webp';
    newThumbnailPath = `${newFileId}${extension}`;
    const srcThumbnailPath = path.join(thumbnailsDir, originalThumbnailName);
    const destThumbnailPath = path.join(thumbnailsDir, newThumbnailPath);
    try {
      await fs.promises.copyFile(srcThumbnailPath, destThumbnailPath);
    } catch (err) {
      console.warn(`Failed to copy thumbnail file: ${srcThumbnailPath} -> ${destThumbnailPath}`);
      newThumbnailPath = null;
    }
  }

  await client.query(
    `INSERT INTO "files" (
      "id", "folder_id", "owner_id", "uuid_storage_name", "original_name",
      "mime_type", "size", "encryption_key_wrapped", "thumbnail_path", "content_text"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      newFileId,
      destParentId,
      userId,
      newStorageName,
      file.original_name,
      file.mime_type,
      file.size,
      file.encryption_key_wrapped,
      newThumbnailPath,
      file.content_text
    ]
  );

  return BigInt(file.size || 0);
}

// Helper to copy a folder recursively and return total bytes copied
async function copyFolderRecursive(client: any, srcFolderId: string, destParentId: string | null, userId: string): Promise<bigint> {
  // 1. Get source folder details
  const folderRes = await client.query(
    'SELECT name FROM "folders" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
    [srcFolderId, userId]
  );
  if (folderRes.rowCount === 0) throw new Error('Folder not found');
  const folderName = folderRes.rows[0].name;

  // 2. Create destination folder
  const newFolderId = uuidv4();
  await client.query(
    `INSERT INTO "folders" (id, parent_id, owner_id, name)
     VALUES ($1, $2, $3, $4)`,
    [newFolderId, destParentId, userId, folderName]
  );

  let totalBytes = BigInt(0);

  // 3. Copy files in this folder
  const filesRes = await client.query(
    `SELECT id 
     FROM "files" 
     WHERE folder_id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [srcFolderId, userId]
  );

  for (const file of filesRes.rows) {
    const bytes = await copyFileDirect(client, file.id, newFolderId, userId);
    totalBytes += bytes;
  }

  // 4. Copy child folders recursively
  const childFoldersRes = await client.query(
    'SELECT id FROM "folders" WHERE parent_id = $1 AND owner_id = $2 AND deleted_at IS NULL',
    [srcFolderId, userId]
  );

  for (const child of childFoldersRes.rows) {
    const bytes = await copyFolderRecursive(client, child.id, newFolderId, userId);
    totalBytes += bytes;
  }

  return totalBytes;
}

// 1. Batch Move
router.post('/resources/batch-move', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { resources, targetFolderId } = req.body;

  if (!Array.isArray(resources) || resources.length === 0) {
    res.status(400).json({ error: 'No resources specified' });
    return;
  }

  const cleanTargetId = targetFolderId === 'root' ? null : targetFolderId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const r of resources) {
      if (r.type === 'file') {
        await client.query(
          'UPDATE "files" SET folder_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND owner_id = $3',
          [cleanTargetId, r.id, userId]
        );
      } else if (r.type === 'folder') {
        if (cleanTargetId === r.id) continue;

        // Check if target folder is a child/descendant of the folder being moved (cycle prevention)
        if (cleanTargetId) {
          const cycleCheck = await client.query(
            `WITH RECURSIVE subfolders AS (
              SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
              UNION ALL
              SELECT f.id FROM "folders" f
              JOIN subfolders s ON f.parent_id = s.id
            )
            SELECT 1 FROM subfolders WHERE id = $3`,
            [r.id, userId, cleanTargetId]
          );

          if (cycleCheck.rowCount && cycleCheck.rowCount > 0) {
            throw new Error(`Cannot move folder into one of its own subfolders`);
          }
        }

        await client.query(
          'UPDATE "folders" SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND owner_id = $3',
          [cleanTargetId, r.id, userId]
        );
      }
    }

    await client.query('COMMIT');

    await logAudit({
      action: 'BATCH_MOVE',
      userId,
      resourceType: 'batch',
      ipAddress: req.ip,
      details: { count: resources.length, targetFolderId: cleanTargetId },
    });

    res.json({ message: 'Resources moved successfully' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Batch Move] Error:', error);
    res.status(400).json({ error: error.message || 'Failed to move resources' });
  } finally {
    client.release();
  }
});

// 2. Batch Delete (Soft delete to Trash)
router.post('/resources/batch-delete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { resources } = req.body;

  if (!Array.isArray(resources) || resources.length === 0) {
    res.status(400).json({ error: 'No resources specified' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const r of resources) {
      if (r.type === 'file') {
        await client.query(
          'UPDATE "files" SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND owner_id = $2',
          [r.id, userId]
        );
      } else if (r.type === 'folder') {
        // Soft delete child files recursively
        await client.query(
          `WITH RECURSIVE subfolders AS (
            SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
            UNION ALL
            SELECT f.id FROM "folders" f
            JOIN subfolders s ON f.parent_id = s.id
          )
          UPDATE "files" 
          SET deleted_at = CURRENT_TIMESTAMP
          WHERE folder_id IN (SELECT id FROM subfolders) AND owner_id = $2 AND deleted_at IS NULL`,
          [r.id, userId]
        );

        // Soft delete folders recursively
        await client.query(
          `WITH RECURSIVE subfolders AS (
            SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
            UNION ALL
            SELECT f.id FROM "folders" f
            JOIN subfolders s ON f.parent_id = s.id
          )
          UPDATE "folders" 
          SET deleted_at = CURRENT_TIMESTAMP
          WHERE id IN (SELECT id FROM subfolders) AND owner_id = $2 AND deleted_at IS NULL`,
          [r.id, userId]
        );
      }
    }

    await client.query('COMMIT');

    await logAudit({
      action: 'BATCH_DELETE',
      userId,
      resourceType: 'batch',
      ipAddress: req.ip,
      details: { count: resources.length },
    });

    res.json({ message: 'Resources moved to Trash' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Batch Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete resources' });
  } finally {
    client.release();
  }
});

// 3. Batch Copy
router.post('/resources/batch-copy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { resources, targetFolderId } = req.body;

  if (!Array.isArray(resources) || resources.length === 0) {
    res.status(400).json({ error: 'No resources specified' });
    return;
  }

  const cleanTargetId = targetFolderId === 'root' ? null : targetFolderId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Quota Check
    const userRes = await client.query(
      'SELECT "storageQuotaBytes", "storageUsedBytes" FROM "user" WHERE id = $1',
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new Error('User not found');
    }

    const quota = BigInt(userRes.rows[0].storageQuotaBytes || '107374182400');
    const used = BigInt(userRes.rows[0].storageUsedBytes || '0');

    let totalBytesCopied = BigInt(0);

    for (const r of resources) {
      if (r.type === 'file') {
        const bytes = await copyFileDirect(client, r.id, cleanTargetId, userId);
        totalBytesCopied += bytes;
      } else if (r.type === 'folder') {
        const bytes = await copyFolderRecursive(client, r.id, cleanTargetId, userId);
        totalBytesCopied += bytes;
      }
    }

    if (used + totalBytesCopied > quota) {
      throw new Error('Storage quota exceeded. Cannot copy selected items.');
    }

    if (totalBytesCopied > BigInt(0)) {
      await client.query(
        'UPDATE "user" SET "storageUsedBytes" = "storageUsedBytes" + $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
        [totalBytesCopied.toString(), userId]
      );
    }

    await client.query('COMMIT');

    await logAudit({
      action: 'BATCH_COPY',
      userId,
      resourceType: 'batch',
      ipAddress: req.ip,
      details: { count: resources.length, targetFolderId: cleanTargetId, bytesCopied: totalBytesCopied.toString() },
    });

    res.json({ message: 'Resources copied successfully', bytesCopied: totalBytesCopied.toString() });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Batch Copy] Error:', error);
    res.status(400).json({ error: error.message || 'Failed to copy resources' });
  } finally {
    client.release();
  }
});

export default router;
