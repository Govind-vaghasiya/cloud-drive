import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { unwrapKey, decryptFileFromDisk, hashSharePassword, verifySharePassword } from '../utils/crypto.js';
import { logAudit } from '../services/audit.js';
import { generateThumbnail } from '../services/thumbnail.js';

const router = Router();

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');
const thumbnailsDir = path.join(storageBaseDir, 'thumbnails');

// In-memory rate-limiter for public share password attempts (max 10 attempts per minute per IP)
const passwordAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = passwordAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    passwordAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count++;
  return true;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// =============================================================================
// 1. Create Share (Public Link or Private User Recipients)
// =============================================================================
router.post('/shares', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      resourceId,
      resourceType = 'file',
      type = 'public',
      password,
      expiresAt,
      permission = 'view',
      recipientEmails = [],
    } = req.body;

    if (!resourceId) {
      res.status(400).json({ error: 'resourceId is required' });
      return;
    }

    if (!['file', 'folder'].includes(resourceType)) {
      res.status(400).json({ error: 'resourceType must be file or folder' });
      return;
    }

    if (!['public', 'private'].includes(type)) {
      res.status(400).json({ error: 'type must be public or private' });
      return;
    }

    // 1. Verify resource ownership
    const table = resourceType === 'file' ? 'files' : 'folders';
    const resourceRes = await pool.query(
      `SELECT id, owner_id, ${resourceType === 'file' ? 'original_name' : 'name'} as name FROM "${table}" WHERE id = $1 AND owner_id = $2`,
      [resourceId, userId]
    );

    if (resourceRes.rowCount === 0) {
      res.status(404).json({ error: `${resourceType} not found or you do not have permission to share it` });
      return;
    }

    const shareId = uuidv4();
    let token: string | null = null;
    let passwordHash: string | null = null;

    if (type === 'public') {
      token = crypto.randomBytes(18).toString('base64url');
      if (password && password.trim().length > 0) {
        passwordHash = hashSharePassword(password.trim());
      }
    }

    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Insert into shares
      const shareResult = await client.query(
        `INSERT INTO "shares" (
          "id", "token", "resource_id", "resource_type", "type",
          "password_hash", "expires_at", "permission", "created_by"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, token, resource_id, resource_type, type, expires_at, permission, created_at`,
        [
          shareId,
          token,
          resourceId,
          resourceType,
          type,
          passwordHash,
          parsedExpiresAt,
          permission,
          userId,
        ]
      );

      const addedRecipients: Array<{ id: string; email: string; name: string }> = [];
      const notFoundEmails: string[] = [];

      // 3. If private share, attach recipient users
      if (type === 'private' && Array.isArray(recipientEmails) && recipientEmails.length > 0) {
        for (const rawEmail of recipientEmails) {
          const email = String(rawEmail).trim().toLowerCase();
          if (!email) continue;

          const userLookup = await client.query(
            'SELECT id, email, name FROM "user" WHERE LOWER(email) = $1',
            [email]
          );

          if (userLookup.rowCount && userLookup.rowCount > 0) {
            const targetUser = userLookup.rows[0];
            const recipientId = uuidv4();
            await client.query(
              `INSERT INTO "share_recipients" ("id", "share_id", "user_id")
               VALUES ($1, $2, $3)
               ON CONFLICT ("share_id", "user_id") DO NOTHING`,
              [recipientId, shareId, targetUser.id]
            );
            addedRecipients.push(targetUser);
          } else {
            notFoundEmails.push(email);
          }
        }
      }

      await client.query('COMMIT');

      // 4. Log Audit
      await logAudit({
        action: 'SHARE_CREATE',
        userId,
        resourceId,
        resourceType,
        ipAddress: req.ip,
        details: { shareId, type, permission, hasPassword: Boolean(passwordHash), token },
      });

      res.status(201).json({
        message: 'Share created successfully',
        share: {
          ...shareResult.rows[0],
          hasPassword: Boolean(passwordHash),
          publicUrl: token ? `/s/${token}` : null,
          recipients: addedRecipients,
          notFoundEmails,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Create Share] Error:', error);
    res.status(500).json({ error: error?.message || 'Failed to create share' });
  }
});

// =============================================================================
// 2. Manage Shares (List all shares created by logged-in user)
// =============================================================================
router.get('/shares/manage', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const sharesResult = await pool.query(
      `SELECT 
        s.id,
        s.token,
        s.resource_id,
        s.resource_type,
        s.type,
        (s.password_hash IS NOT NULL) as "has_password",
        s.expires_at,
        s.permission,
        s.created_at,
        f.original_name as file_name,
        f.size as file_size,
        f.mime_type as file_mime,
        f.thumbnail_path as file_thumbnail,
        fol.name as folder_name,
        COALESCE(
          json_agg(
            json_build_object('id', u.id, 'name', u.name, 'email', u.email)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as recipients
      FROM "shares" s
      LEFT JOIN "files" f ON s.resource_id = f.id AND s.resource_type = 'file'
      LEFT JOIN "folders" fol ON s.resource_id = fol.id AND s.resource_type = 'folder'
      LEFT JOIN "share_recipients" sr ON s.id = sr.share_id
      LEFT JOIN "user" u ON sr.user_id = u.id
      WHERE s.created_by = $1
      GROUP BY s.id, f.original_name, f.size, f.mime_type, f.thumbnail_path, fol.name
      ORDER BY s.created_at DESC`,
      [userId]
    );

    const shares = sharesResult.rows.map((row) => {
      const isFile = row.resource_type === 'file';
      const name = isFile ? row.file_name || 'Unknown File' : row.folder_name || 'Unknown Folder';
      const isExpired = row.expires_at ? new Date(row.expires_at) < new Date() : false;

      return {
        id: row.id,
        token: row.token,
        publicUrl: row.token ? `/s/${row.token}` : null,
        resourceId: row.resource_id,
        resourceType: row.resource_type,
        name,
        type: row.type,
        hasPassword: row.has_password,
        expiresAt: row.expires_at,
        isExpired,
        permission: row.permission,
        createdAt: row.created_at,
        fileDetails: isFile ? {
          size: Number(row.file_size || 0),
          sizeFormatted: formatBytes(Number(row.file_size || 0)),
          mimeType: row.file_mime,
          thumbnailPath: row.file_thumbnail,
        } : null,
        recipients: row.recipients || [],
      };
    });

    res.json({ shares });
  } catch (error: any) {
    console.error('[Manage Shares] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve user shares' });
  }
});

// =============================================================================
// 3. Shared With Me (List items shared privately with logged-in user)
// =============================================================================
router.get('/shares/shared-with-me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT 
        s.id as share_id,
        s.permission,
        s.expires_at,
        s.created_at as shared_at,
        owner.name as owner_name,
        owner.email as owner_email,
        s.resource_type,
        s.resource_id,
        f.original_name as file_name,
        f.size as file_size,
        f.mime_type as file_mime,
        f.thumbnail_path as file_thumbnail,
        f.created_at as file_created_at,
        fol.name as folder_name,
        fol.created_at as folder_created_at
      FROM "share_recipients" sr
      JOIN "shares" s ON sr.share_id = s.id
      JOIN "user" owner ON s.created_by = owner.id
      LEFT JOIN "files" f ON s.resource_id = f.id AND s.resource_type = 'file'
      LEFT JOIN "folders" fol ON s.resource_id = fol.id AND s.resource_type = 'folder'
      WHERE sr.user_id = $1 AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
      ORDER BY s.created_at DESC`,
      [userId]
    );

    const items = result.rows.map((row) => {
      const isFile = row.resource_type === 'file';
      const name = isFile ? row.file_name || 'Shared File' : row.folder_name || 'Shared Folder';

      return {
        shareId: row.share_id,
        resourceId: row.resource_id,
        resourceType: row.resource_type,
        name,
        permission: row.permission,
        expiresAt: row.expires_at,
        sharedAt: row.shared_at,
        owner: {
          name: row.owner_name,
          email: row.owner_email,
        },
        fileDetails: isFile ? {
          size: Number(row.file_size || 0),
          sizeFormatted: formatBytes(Number(row.file_size || 0)),
          mimeType: row.file_mime,
          thumbnailPath: row.file_thumbnail,
          createdAt: row.file_created_at,
        } : null,
      };
    });

    res.json({ sharedItems: items });
  } catch (error: any) {
    console.error('[Shared With Me] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve shared items' });
  }
});

// =============================================================================
// 4. Revoke Share
// =============================================================================
router.delete('/shares/:shareId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shareId } = req.params;

    const shareCheck = await pool.query(
      'SELECT id, resource_id, resource_type, type FROM "shares" WHERE id = $1 AND created_by = $2',
      [shareId, userId]
    );

    if (shareCheck.rowCount === 0) {
      res.status(404).json({ error: 'Share not found or you do not have permission to revoke it' });
      return;
    }

    const share = shareCheck.rows[0];
    await pool.query('DELETE FROM "shares" WHERE id = $1', [shareId]);

    await logAudit({
      action: 'SHARE_REVOKE',
      userId,
      resourceId: share.resource_id,
      resourceType: share.resource_type,
      ipAddress: req.ip,
      details: { shareId, type: share.type },
    });

    res.json({ message: 'Share revoked successfully', shareId });
  } catch (error: any) {
    console.error('[Revoke Share] Error:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// =============================================================================
// 5. Public Share Meta & Access Validation (/api/s/:token/meta)
// =============================================================================
router.all('/s/:token/meta', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const clientIp = req.ip || 'unknown';

    const shareRes = await pool.query(
      `SELECT s.*, u.name as owner_name 
       FROM "shares" s
       JOIN "user" u ON s.created_by = u.id
       WHERE s.token = $1 AND s.type = 'public'`,
      [token]
    );

    if (shareRes.rowCount === 0) {
      res.status(404).json({ error: 'Share link not found or has been revoked' });
      return;
    }

    const share = shareRes.rows[0];

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ error: 'This share link has expired' });
      return;
    }

    const passwordHeader = req.headers['x-share-password'] as string | undefined;
    const passwordBody = req.body?.password;
    const suppliedPassword = passwordHeader || passwordBody;

    // If password protected, check credentials
    if (share.password_hash) {
      if (!suppliedPassword) {
        res.json({
          passwordRequired: true,
          resourceType: share.resource_type,
          ownerName: share.owner_name,
        });
        return;
      }

      if (!checkRateLimit(clientIp)) {
        res.status(429).json({ error: 'Too many password attempts. Please wait a minute and try again.' });
        return;
      }

      const isValid = verifySharePassword(suppliedPassword, share.password_hash);
      if (!isValid) {
        res.status(401).json({ error: 'Incorrect password', passwordRequired: true });
        return;
      }
    }

    // Unlocked or public without password -> return full metadata
    if (share.resource_type === 'file') {
      const fileRes = await pool.query(
        'SELECT id, original_name, mime_type, size, thumbnail_path, created_at, updated_at FROM "files" WHERE id = $1',
        [share.resource_id]
      );

      if (fileRes.rowCount === 0) {
        res.status(404).json({ error: 'The shared file was deleted' });
        return;
      }

      const file = fileRes.rows[0];
      res.json({
        passwordRequired: false,
        share: {
          id: share.id,
          permission: share.permission,
          expiresAt: share.expires_at,
          createdAt: share.created_at,
          ownerName: share.owner_name,
        },
        resource: {
          id: file.id,
          type: 'file',
          name: file.original_name,
          mimeType: file.mime_type,
          size: Number(file.size),
          sizeFormatted: formatBytes(Number(file.size)),
          thumbnailPath: file.thumbnail_path,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
        },
      });
    } else {
      const folderRes = await pool.query(
        'SELECT id, name, created_at FROM "folders" WHERE id = $1',
        [share.resource_id]
      );

      if (folderRes.rowCount === 0) {
        res.status(404).json({ error: 'The shared folder was deleted' });
        return;
      }

      const folder = folderRes.rows[0];
      res.json({
        passwordRequired: false,
        share: {
          id: share.id,
          permission: share.permission,
          expiresAt: share.expires_at,
          createdAt: share.created_at,
          ownerName: share.owner_name,
        },
        resource: {
          id: folder.id,
          type: 'folder',
          name: folder.name,
          createdAt: folder.created_at,
        },
      });
    }
  } catch (error: any) {
    console.error('[Public Share Meta] Error:', error);
    res.status(500).json({ error: 'Failed to access public share' });
  }
});

// Helper to validate public share access for streaming/downloading
async function validatePublicAccess(req: Request, token: string) {
  const shareRes = await pool.query(
    'SELECT * FROM "shares" WHERE token = $1 AND type = \'public\'',
    [token]
  );

  if (shareRes.rowCount === 0) return { error: 'Share link not found or revoked', status: 404 };

  const share = shareRes.rows[0];
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { error: 'Share link has expired', status: 410 };
  }

  if (share.password_hash) {
    const pwd = (req.query.pwd as string) || (req.headers['x-share-password'] as string) || req.body?.password;
    if (!pwd || !verifySharePassword(pwd, share.password_hash)) {
      return { error: 'Invalid or missing password for this shared resource', status: 401 };
    }
  }

  return { share };
}

// =============================================================================
// 6. Public Share Download (/api/s/:token/download)
// =============================================================================
router.all('/s/:token/download', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const authCheck = await validatePublicAccess(req, token);

    if ('error' in authCheck && authCheck.error) {
      res.status(authCheck.status || 403).json({ error: authCheck.error });
      return;
    }

    const { share } = authCheck as { share: any };
    if (share.resource_type !== 'file') {
      res.status(400).json({ error: 'Folder downloads not supported directly via link' });
      return;
    }

    const fileRes = await pool.query(
      'SELECT id, original_name, mime_type, size, uuid_storage_name, encryption_key_wrapped FROM "files" WHERE id = $1',
      [share.resource_id]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'Shared file not found' });
      return;
    }

    const file = fileRes.rows[0];
    const encryptedFilePath = path.join(filesDir, file.uuid_storage_name);

    if (!fs.existsSync(encryptedFilePath)) {
      res.status(404).json({ error: 'Storage file not found on server' });
      return;
    }

    const fileKey = unwrapKey(file.encryption_key_wrapped);
    const decryptedBuffer = await decryptFileFromDisk(encryptedFilePath, fileKey);

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    await logAudit({
      action: 'PUBLIC_SHARE_DOWNLOAD',
      userId: null,
      resourceId: file.id,
      resourceType: 'file',
      ipAddress: req.ip,
      details: { filename: file.original_name, token },
    });

    res.send(decryptedBuffer);
  } catch (error: any) {
    console.error('[Public Download] Error:', error);
    res.status(500).json({ error: 'Failed to download shared file' });
  }
});

// =============================================================================
// 7. Public Share Preview (/api/s/:token/preview)
// =============================================================================
router.all('/s/:token/preview', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const authCheck = await validatePublicAccess(req, token);

    if ('error' in authCheck && authCheck.error) {
      res.status(authCheck.status || 403).json({ error: authCheck.error });
      return;
    }

    const { share } = authCheck as { share: any };
    if (share.resource_type !== 'file') {
      res.status(400).json({ error: 'Preview only supported for files' });
      return;
    }

    const fileRes = await pool.query(
      'SELECT id, original_name, mime_type, size, uuid_storage_name, encryption_key_wrapped FROM "files" WHERE id = $1',
      [share.resource_id]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'Shared file not found' });
      return;
    }

    const file = fileRes.rows[0];
    const encryptedFilePath = path.join(filesDir, file.uuid_storage_name);

    if (!fs.existsSync(encryptedFilePath)) {
      res.status(404).json({ error: 'Storage file not found' });
      return;
    }

    const fileKey = unwrapKey(file.encryption_key_wrapped);
    const decryptedBuffer = await decryptFileFromDisk(encryptedFilePath, fileKey);

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    res.send(decryptedBuffer);
  } catch (error: any) {
    console.error('[Public Preview] Error:', error);
    res.status(500).json({ error: 'Failed to preview shared file' });
  }
});

// =============================================================================
// 8. Public Share Thumbnail (/api/s/:token/thumbnail)
// =============================================================================
router.all('/s/:token/thumbnail', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const authCheck = await validatePublicAccess(req, token);

    if ('error' in authCheck && authCheck.error) {
      res.status(authCheck.status || 403).json({ error: authCheck.error });
      return;
    }

    const { share } = authCheck as { share: any };
    const fileId = share.resource_id;

    const fileRes = await pool.query(
      'SELECT id, thumbnail_path FROM "files" WHERE id = $1',
      [fileId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = fileRes.rows[0];
    let thumbnailFilename = file.thumbnail_path || `${fileId}.webp`;
    let thumbnailDiskPath = path.join(thumbnailsDir, path.basename(thumbnailFilename));

    if (!fs.existsSync(thumbnailDiskPath)) {
      const generated = await generateThumbnail(fileId);
      if (!generated) {
        res.status(404).json({ error: 'Thumbnail not available' });
        return;
      }
      thumbnailDiskPath = path.join(thumbnailsDir, path.basename(generated));
    }

    if (!fs.existsSync(thumbnailDiskPath)) {
      res.status(404).json({ error: 'Thumbnail missing' });
      return;
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    fs.createReadStream(thumbnailDiskPath).pipe(res);
  } catch (error: any) {
    console.error('[Public Thumbnail] Error:', error);
    res.status(500).json({ error: 'Failed to serve shared thumbnail' });
  }
});

export default router;
