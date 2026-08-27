import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');
const thumbnailsDir = path.join(storageBaseDir, 'thumbnails');

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// =============================================================================
// 1. List Trash Items (Files and Folders)
// =============================================================================
router.get('/trash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get trashed files
    const filesRes = await pool.query(
      `SELECT id, folder_id, original_name as name, mime_type, size, thumbnail_path, deleted_at, created_at
       FROM "files"
       WHERE owner_id = $1 AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [userId]
    );

    // Get trashed folders
    const foldersRes = await pool.query(
      `SELECT id, parent_id, name, deleted_at, created_at
       FROM "folders"
       WHERE owner_id = $1 AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [userId]
    );

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const files = filesRes.rows.map((f) => {
      const deletedTime = new Date(f.deleted_at).getTime();
      const expiresAt = new Date(deletedTime + thirtyDaysMs);
      const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)));

      return {
        id: f.id,
        type: 'file' as const,
        name: f.name,
        mimeType: f.mime_type,
        size: Number(f.size),
        sizeFormatted: formatBytes(Number(f.size)),
        thumbnailPath: f.thumbnail_path,
        deletedAt: f.deleted_at,
        expiresAt: expiresAt.toISOString(),
        daysRemaining,
      };
    });

    const folders = foldersRes.rows.map((fol) => {
      const deletedTime = new Date(fol.deleted_at).getTime();
      const expiresAt = new Date(deletedTime + thirtyDaysMs);
      const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)));

      return {
        id: fol.id,
        type: 'folder' as const,
        name: fol.name,
        deletedAt: fol.deleted_at,
        expiresAt: expiresAt.toISOString(),
        daysRemaining,
      };
    });

    res.json({
      trashItems: [...folders, ...files],
      totalCount: files.length + folders.length,
    });
  } catch (error: any) {
    console.error('[Get Trash] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve trash items' });
  }
});

// =============================================================================
// 2. Restore Item (File or Folder)
// =============================================================================
router.post('/trash/restore', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id, type } = req.body;

    if (!id || !type || !['file', 'folder'].includes(type)) {
      res.status(400).json({ error: 'id and valid type (file or folder) are required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (type === 'file') {
        const fileCheck = await client.query(
          'SELECT id, folder_id, original_name FROM "files" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL',
          [id, userId]
        );

        if (fileCheck.rowCount === 0) {
          res.status(404).json({ error: 'File not found in Trash' });
          return;
        }

        const file = fileCheck.rows[0];

        // If parent folder is in trash or deleted, restore to root
        if (file.folder_id) {
          const parentCheck = await client.query(
            'SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
            [file.folder_id, userId]
          );
          if (parentCheck.rowCount === 0) {
            await client.query('UPDATE "files" SET "folder_id" = NULL WHERE id = $1', [id]);
          }
        }

        await client.query('UPDATE "files" SET "deleted_at" = NULL WHERE id = $1', [id]);
      } else {
        const folderCheck = await client.query(
          'SELECT id, parent_id, name FROM "folders" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL',
          [id, userId]
        );

        if (folderCheck.rowCount === 0) {
          res.status(404).json({ error: 'Folder not found in Trash' });
          return;
        }

        const folder = folderCheck.rows[0];

        // If parent folder is in trash or deleted, restore to root
        if (folder.parent_id) {
          const parentCheck = await client.query(
            'SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
            [folder.parent_id, userId]
          );
          if (parentCheck.rowCount === 0) {
            await client.query('UPDATE "folders" SET "parent_id" = NULL WHERE id = $1', [id]);
          }
        }

        // Restore folder and all subfolders & files
        await client.query(
          `WITH RECURSIVE subfolders AS (
            SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
            UNION ALL
            SELECT f.id FROM "folders" f
            JOIN subfolders s ON f.parent_id = s.id
          )
          UPDATE "folders" SET "deleted_at" = NULL WHERE id IN (SELECT id FROM subfolders)`,
          [id, userId]
        );

        await client.query(
          `WITH RECURSIVE subfolders AS (
            SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
            UNION ALL
            SELECT f.id FROM "folders" f
            JOIN subfolders s ON f.parent_id = s.id
          )
          UPDATE "files" SET "deleted_at" = NULL WHERE folder_id IN (SELECT id FROM subfolders) AND owner_id = $2`,
          [id, userId]
        );
      }

      await client.query('COMMIT');

      await logAudit({
        action: 'FILE_RENAME', // Activity log entry for restore
        userId,
        resourceId: id,
        resourceType: type,
        ipAddress: req.ip,
        details: { action: 'RESTORE_FROM_TRASH', id, type },
      });

      res.json({ message: 'Item restored successfully', id, type });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Restore Trash] Error:', error);
    res.status(500).json({ error: 'Failed to restore item' });
  }
});

// =============================================================================
// 3. Permanently Delete Item (File or Folder)
// =============================================================================
router.delete('/trash/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const type = req.query.type as string | undefined;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if it's a file
      const fileRes = await client.query(
        'SELECT id, original_name, size, uuid_storage_name, thumbnail_path FROM "files" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL',
        [id, userId]
      );

      if (fileRes.rowCount && fileRes.rowCount > 0) {
        const file = fileRes.rows[0];
        const filePath = path.join(filesDir, file.uuid_storage_name);
        const thumbnailPath = path.join(thumbnailsDir, `${id}.webp`);

        await client.query('DELETE FROM "files" WHERE id = $1', [id]);
        await client.query(
          'UPDATE "user" SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" - $1), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
          [file.size, userId]
        );

        await client.query('COMMIT');

        await fs.promises.unlink(filePath).catch(() => {});
        await fs.promises.unlink(thumbnailPath).catch(() => {});

        res.json({ message: 'File permanently deleted', id });
        return;
      }

      // Check if it's a folder
      const folderRes = await client.query(
        'SELECT id, name FROM "folders" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL',
        [id, userId]
      );

      if (folderRes.rowCount && folderRes.rowCount > 0) {
        const filesToDeleteRes = await client.query(
          `WITH RECURSIVE subfolders AS (
            SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
            UNION ALL
            SELECT f.id FROM "folders" f
            JOIN subfolders s ON f.parent_id = s.id
          )
          SELECT id, uuid_storage_name, size, thumbnail_path FROM "files"
          WHERE folder_id IN (SELECT id FROM subfolders) AND owner_id = $2`,
          [id, userId]
        );

        const filesToDelete = filesToDeleteRes.rows;
        let bytesReclaimed = BigInt(0);

        for (const f of filesToDelete) {
          bytesReclaimed += BigInt(f.size);
          const fPath = path.join(filesDir, f.uuid_storage_name);
          const tPath = path.join(thumbnailsDir, `${f.id}.webp`);
          await fs.promises.unlink(fPath).catch(() => {});
          await fs.promises.unlink(tPath).catch(() => {});
        }

        // Delete folder (cascades)
        await client.query('DELETE FROM "folders" WHERE id = $1', [id]);

        if (bytesReclaimed > 0) {
          await client.query(
            'UPDATE "user" SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" - $1), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
            [bytesReclaimed.toString(), userId]
          );
        }

        await client.query('COMMIT');

        res.json({ message: 'Folder and contents permanently deleted', id });
        return;
      }

      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Item not found in Trash' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Permanent Delete] Error:', error);
    res.status(500).json({ error: 'Failed to permanently delete item' });
  }
});

// =============================================================================
// 4. Empty Trash (Permanently purge all soft-deleted items for user)
// =============================================================================
router.delete('/trash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Fetch all trashed files for user
      const filesRes = await client.query(
        'SELECT id, uuid_storage_name, size, thumbnail_path FROM "files" WHERE owner_id = $1 AND deleted_at IS NOT NULL',
        [userId]
      );

      const files = filesRes.rows;
      let totalBytes = BigInt(0);

      for (const f of files) {
        totalBytes += BigInt(f.size);
        const fPath = path.join(filesDir, f.uuid_storage_name);
        const tPath = path.join(thumbnailsDir, `${f.id}.webp`);
        await fs.promises.unlink(fPath).catch(() => {});
        await fs.promises.unlink(tPath).catch(() => {});
      }

      // Delete files and folders from DB
      await client.query('DELETE FROM "files" WHERE owner_id = $1 AND deleted_at IS NOT NULL', [userId]);
      await client.query('DELETE FROM "folders" WHERE owner_id = $1 AND deleted_at IS NOT NULL', [userId]);

      if (totalBytes > 0) {
        await client.query(
          'UPDATE "user" SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" - $1), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
          [totalBytes.toString(), userId]
        );
      }

      await client.query('COMMIT');

      await logAudit({
        action: 'FILE_DELETE',
        userId,
        resourceId: null,
        resourceType: 'system',
        ipAddress: req.ip,
        details: { action: 'EMPTY_TRASH', filesPurgedCount: files.length, bytesReclaimed: totalBytes.toString() },
      });

      res.json({
        message: 'Trash emptied successfully',
        purgedFilesCount: files.length,
        bytesReclaimed: totalBytes.toString(),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Empty Trash] Error:', error);
    res.status(500).json({ error: 'Failed to empty trash' });
  }
});

export default router;
