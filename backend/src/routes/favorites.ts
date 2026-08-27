import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { formatBytes } from './files.js';

const router = Router();

// =============================================================================
// 1. Toggle Favorite / Starred Status on a File or Folder
// =============================================================================
router.post('/favorites/toggle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { resourceId, resourceType } = req.body;

    if (!resourceId || !resourceType || (resourceType !== 'file' && resourceType !== 'folder')) {
      res.status(400).json({ error: 'Valid resourceId and resourceType (file/folder) are required' });
      return;
    }

    const table = resourceType === 'file' ? 'files' : 'folders';

    // Verify ownership
    const itemRes = await pool.query(
      `SELECT id, is_starred FROM "${table}" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [resourceId, userId]
    );

    if (itemRes.rowCount === 0) {
      res.status(404).json({ error: `${resourceType === 'file' ? 'File' : 'Folder'} not found` });
      return;
    }

    const currentStatus = itemRes.rows[0].is_starred;
    const newStatus = !currentStatus;

    await pool.query(
      `UPDATE "${table}" SET is_starred = $1 WHERE id = $2`,
      [newStatus, resourceId]
    );

    res.json({
      resourceId,
      resourceType,
      isStarred: newStatus,
      message: newStatus ? 'Added to favorites' : 'Removed from favorites',
    });
  } catch (error: any) {
    console.error('[Toggle Favorite] Error:', error);
    res.status(500).json({ error: 'Failed to update favorite status' });
  }
});

// =============================================================================
// 2. List All Starred / Favorite Files and Folders
// =============================================================================
router.get('/favorites', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch starred folders
    const foldersRes = await pool.query(
      `SELECT id, name, created_at, is_starred
       FROM "folders"
       WHERE owner_id = $1 AND is_starred = true AND deleted_at IS NULL
       ORDER BY name ASC`,
      [userId]
    );

    // Fetch starred files
    const filesRes = await pool.query(
      `SELECT id, folder_id, original_name, mime_type, size, thumbnail_path, is_starred, created_at, updated_at
       FROM "files"
       WHERE owner_id = $1 AND is_starred = true AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId]
    );

    const folders = foldersRes.rows.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.created_at,
      isStarred: true,
    }));

    const files = filesRes.rows.map((f) => ({
      id: f.id,
      folderId: f.folder_id,
      name: f.original_name,
      mimeType: f.mime_type,
      size: Number(f.size),
      sizeFormatted: formatBytes(Number(f.size)),
      thumbnailPath: f.thumbnail_path,
      isStarred: true,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({ folders, files });
  } catch (error: any) {
    console.error('[List Favorites] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve favorite items' });
  }
});

export default router;
