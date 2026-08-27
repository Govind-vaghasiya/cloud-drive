import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { unwrapKey, decryptFileFromDisk } from '../utils/crypto.js';
import { formatBytes } from './files.js';
import { logAudit } from '../services/audit.js';

const router = Router();
const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');

// =============================================================================
// 1. Get All Version Snapshots for a File
// =============================================================================
router.get('/files/:fileId/versions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    // Verify file access
    const fileRes = await pool.query(
      `SELECT f.id, f.original_name, f.mime_type, f.size, f.updated_at, f.owner_id, u.name as owner_name
       FROM "files" f
       JOIN "user" u ON f.owner_id = u.id
       WHERE f.id = $1 AND f.deleted_at IS NULL AND f.owner_id = $2`,
      [fileId, userId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileRes.rows[0];

    // Fetch historical versions
    const versionsRes = await pool.query(
      `SELECT v.id, v.version_number, v.size, v.created_at, u.name as author_name, u.email as author_email
       FROM "file_versions" v
       LEFT JOIN "user" u ON v.created_by = u.id
       WHERE v.file_id = $1
       ORDER BY v.version_number DESC`,
      [fileId]
    );

    const historicalVersions = versionsRes.rows.map((v) => ({
      id: v.id,
      versionNumber: v.version_number,
      size: Number(v.size),
      sizeFormatted: formatBytes(Number(v.size)),
      authorName: v.author_name || 'System',
      authorEmail: v.author_email,
      createdAt: v.created_at,
      isCurrent: false,
    }));

    // Next version number calculation
    const currentVersionNumber = historicalVersions.length > 0
      ? historicalVersions[0].versionNumber + 1
      : 1;

    const currentVersion = {
      id: 'current',
      versionNumber: currentVersionNumber,
      size: Number(file.size),
      sizeFormatted: formatBytes(Number(file.size)),
      authorName: file.owner_name,
      createdAt: file.updated_at,
      isCurrent: true,
    };

    res.json({
      fileId: file.id,
      fileName: file.original_name,
      currentVersion,
      versions: [currentVersion, ...historicalVersions],
    });
  } catch (error: any) {
    console.error('[Get File Versions] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve version history' });
  }
});

// =============================================================================
// 2. Restore an Older Version Snapshot
// =============================================================================
router.post('/files/:fileId/versions/:versionId/restore', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId, versionId } = req.params;

    // Verify ownership
    const fileRes = await pool.query(
      'SELECT id, owner_id, original_name, size, uuid_storage_name, encryption_key_wrapped FROM "files" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [fileId, userId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const targetVersionRes = await pool.query(
      'SELECT * FROM "file_versions" WHERE id = $1 AND file_id = $2',
      [versionId, fileId]
    );

    if (targetVersionRes.rowCount === 0) {
      res.status(404).json({ error: 'Target version snapshot not found' });
      return;
    }

    const file = fileRes.rows[0];
    const targetVersion = targetVersionRes.rows[0];

    // Determine current max version number
    const maxVerRes = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) as max_ver FROM "file_versions" WHERE file_id = $1',
      [fileId]
    );
    const nextVerNumber = parseInt(maxVerRes.rows[0].max_ver, 10) + 1;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Archive current file state into file_versions
      await client.query(
        `INSERT INTO "file_versions" (id, file_id, version_number, size, uuid_storage_name, encryption_key_wrapped, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          fileId,
          nextVerNumber,
          file.size,
          file.uuid_storage_name,
          file.encryption_key_wrapped,
          userId,
        ]
      );

      // 2. Update active file with the snapshot properties
      await client.query(
        `UPDATE "files"
         SET size = $1, uuid_storage_name = $2, encryption_key_wrapped = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [targetVersion.size, targetVersion.uuid_storage_name, targetVersion.encryption_key_wrapped, fileId]
      );

      // 3. Adjust storage used delta
      const sizeDelta = BigInt(targetVersion.size) - BigInt(file.size);
      if (sizeDelta !== BigInt(0)) {
        await client.query(
          `UPDATE "user"
           SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" + $1), "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2`,
          [sizeDelta.toString(), userId]
        );
      }

      await client.query('COMMIT');

      await logAudit({
        action: 'FILE_UPLOAD',
        userId,
        resourceId: fileId,
        resourceType: 'file',
        ipAddress: req.ip,
        details: { action: 'RESTORE_VERSION', restoredVersionNumber: targetVersion.version_number, filename: file.original_name },
      });

      res.json({
        message: `Version ${targetVersion.version_number} restored successfully`,
        fileId,
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Restore Version] Error:', error);
    res.status(500).json({ error: 'Failed to restore file version' });
  }
});

// =============================================================================
// 3. Download a Historical Version Snapshot
// =============================================================================
router.get('/files/:fileId/versions/:versionId/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId, versionId } = req.params;

    // Verify file access
    const fileRes = await pool.query(
      'SELECT original_name, mime_type FROM "files" WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [fileId, userId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const versionRes = await pool.query(
      'SELECT * FROM "file_versions" WHERE id = $1 AND file_id = $2',
      [versionId, fileId]
    );

    if (versionRes.rowCount === 0) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    const file = fileRes.rows[0];
    const version = versionRes.rows[0];
    const encryptedPath = path.join(filesDir, version.uuid_storage_name);

    if (!fs.existsSync(encryptedPath)) {
      res.status(404).json({ error: 'Version storage blob not found' });
      return;
    }

    const fileKey = unwrapKey(version.encryption_key_wrapped);
    const decryptedBuffer = await decryptFileFromDisk(encryptedPath, fileKey);

    const ext = path.extname(file.original_name);
    const base = path.basename(file.original_name, ext);
    const versionFilename = `${base}_v${version.version_number}${ext}`;

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(versionFilename)}"`);
    res.send(decryptedBuffer);
  } catch (error: any) {
    console.error('[Download Version] Error:', error);
    res.status(500).json({ error: 'Failed to download version snapshot' });
  }
});

export default router;
