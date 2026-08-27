import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { QueryResult } from 'pg';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');

interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
}

// Helper to build breadcrumb trail for navigation
async function getBreadcrumbs(folderId: string | null, userId: string): Promise<Array<{ id: string; name: string }>> {
  if (!folderId) return [{ id: 'root', name: 'My Drive' }];

  const trail: Array<{ id: string; name: string }> = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const queryResult: QueryResult<FolderRow> = await pool.query(
      'SELECT id, parent_id, name FROM "folders" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [currentId, userId]
    );

    if (queryResult.rowCount === 0) break;
    const folderRecord: FolderRow = queryResult.rows[0];
    trail.unshift({ id: folderRecord.id, name: folderRecord.name });
    currentId = folderRecord.parent_id;
  }

  trail.unshift({ id: 'root', name: 'My Drive' });
  return trail;
}

// =============================================================================
// 1. List Folders & Breadcrumbs
// =============================================================================
router.get('/folders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const parentIdParam = req.query.parentId as string | undefined;
    const parentId = parentIdParam && parentIdParam !== 'root' ? parentIdParam : null;

    const folderQuery = parentId
      ? `SELECT f.id, f.parent_id, f.name, f.is_starred, f.created_at, f.updated_at,
                EXISTS(SELECT 1 FROM "shares" s WHERE s.resource_id = f.id) as is_shared
         FROM "folders" f
         WHERE f.owner_id = $1 AND f.parent_id = $2 AND f.deleted_at IS NULL
         ORDER BY f.name ASC`
      : `SELECT f.id, f.parent_id, f.name, f.is_starred, f.created_at, f.updated_at,
                EXISTS(SELECT 1 FROM "shares" s WHERE s.resource_id = f.id) as is_shared
         FROM "folders" f
         WHERE f.owner_id = $1 AND f.parent_id IS NULL AND f.deleted_at IS NULL
         ORDER BY f.name ASC`;

    const params = parentId ? [userId, parentId] : [userId];
    const foldersRes = await pool.query(folderQuery, params);
    const breadcrumbs = await getBreadcrumbs(parentId, userId);

    const folders = foldersRes.rows.map((f) => ({
      id: f.id,
      parentId: f.parent_id,
      name: f.name,
      isStarred: Boolean(f.is_starred),
      isShared: Boolean(f.is_shared),
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    res.json({
      folders,
      breadcrumbs,
      currentFolderId: parentId || 'root',
    });
  } catch (error: any) {
    console.error('[Get Folders] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve folders' });
  }
});

// =============================================================================
// 2. Create New Folder
// =============================================================================
router.post('/folders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, parentId: rawParentId } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Folder name is required' });
      return;
    }

    const parentId = rawParentId && rawParentId !== 'root' ? rawParentId : null;

    // If parentId provided, verify it exists and belongs to user
    if (parentId) {
      const parentCheck = await pool.query(
        'SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2',
        [parentId, userId]
      );
      if (parentCheck.rowCount === 0) {
        res.status(404).json({ error: 'Parent folder not found' });
        return;
      }
    }

    const folderId = uuidv4();
    const result = await pool.query(
      `INSERT INTO "folders" ("id", "parent_id", "owner_id", "name")
       VALUES ($1, $2, $3, $4)
       RETURNING id, parent_id, name, created_at, updated_at`,
      [folderId, parentId, userId, name.trim()]
    );

    await logAudit({
      action: 'FOLDER_CREATE',
      userId,
      resourceId: folderId,
      resourceType: 'folder',
      ipAddress: req.ip,
      details: { name: name.trim(), parentId },
    });

    res.status(201).json({
      message: 'Folder created successfully',
      folder: result.rows[0],
    });
  } catch (error: any) {
    console.error('[Create Folder] Error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// =============================================================================
// 3. Rename or Move Folder
// =============================================================================
router.patch('/folders/:folderId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folderId } = req.params;
    const { name, parentId: rawParentId } = req.body;

    // Check ownership
    const folderRes = await pool.query(
      'SELECT id, parent_id, name FROM "folders" WHERE id = $1 AND owner_id = $2',
      [folderId, userId]
    );

    if (folderRes.rowCount === 0) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    const currentFolder = folderRes.rows[0];
    const newName = name !== undefined ? name.trim() : currentFolder.name;
    const newParentId = rawParentId !== undefined 
      ? (rawParentId === 'root' ? null : rawParentId) 
      : currentFolder.parent_id;

    // Prevent cycle: folder cannot become parent of itself
    if (newParentId === folderId) {
      res.status(400).json({ error: 'A folder cannot be moved into itself' });
      return;
    }

    const result = await pool.query(
      `UPDATE "folders" 
       SET "name" = $1, "parent_id" = $2, "updated_at" = CURRENT_TIMESTAMP 
       WHERE "id" = $3 AND "owner_id" = $4
       RETURNING id, parent_id, name, created_at, updated_at`,
      [newName, newParentId, folderId, userId]
    );

    if (name !== undefined && name !== currentFolder.name) {
      await logAudit({
        action: 'FOLDER_RENAME',
        userId,
        resourceId: folderId,
        resourceType: 'folder',
        ipAddress: req.ip,
        details: { oldName: currentFolder.name, newName },
      });
    }

    if (rawParentId !== undefined && newParentId !== currentFolder.parent_id) {
      await logAudit({
        action: 'FOLDER_MOVE',
        userId,
        resourceId: folderId,
        resourceType: 'folder',
        ipAddress: req.ip,
        details: { oldParentId: currentFolder.parent_id, newParentId },
      });
    }

    res.json({
      message: 'Folder updated successfully',
      folder: result.rows[0],
    });
  } catch (error: any) {
    console.error('[Update Folder] Error:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// =============================================================================
// 4. Delete Folder (Soft-delete folder and all nested files & subfolders)
// =============================================================================
router.delete('/folders/:folderId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folderId } = req.params;

    const folderRes = await pool.query(
      'SELECT id, name FROM "folders" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [folderId, userId]
    );

    if (folderRes.rowCount === 0) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    // CTE recursive query to soft-delete all subfolders and files
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Soft delete child files
      const filesSoftDeleted = await client.query(
        `WITH RECURSIVE subfolders AS (
          SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
          UNION ALL
          SELECT f.id FROM "folders" f
          JOIN subfolders s ON f.parent_id = s.id
        )
        UPDATE "files" 
        SET "deleted_at" = CURRENT_TIMESTAMP
        WHERE folder_id IN (SELECT id FROM subfolders) AND owner_id = $2 AND deleted_at IS NULL
        RETURNING id`,
        [folderId, userId]
      );

      // Soft delete folder and subfolders
      await client.query(
        `WITH RECURSIVE subfolders AS (
          SELECT id FROM "folders" WHERE id = $1 AND owner_id = $2
          UNION ALL
          SELECT f.id FROM "folders" f
          JOIN subfolders s ON f.parent_id = s.id
        )
        UPDATE "folders"
        SET "deleted_at" = CURRENT_TIMESTAMP
        WHERE id IN (SELECT id FROM subfolders) AND owner_id = $2`,
        [folderId, userId]
      );

      await client.query('COMMIT');

      await logAudit({
        action: 'FOLDER_DELETE',
        userId,
        resourceId: folderId,
        resourceType: 'folder',
        ipAddress: req.ip,
        details: { folderName: folderRes.rows[0].name, filesCount: filesSoftDeleted.rowCount, softDelete: true },
      });

      res.json({
        message: 'Folder moved to Trash',
        folderId,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Delete Folder] Error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

export default router;

