import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { generateFileKey, wrapKey, unwrapKey, encryptFileToDisk, decryptFileFromDisk } from '../utils/crypto.js';
import { signOfficeJwt, verifyOfficeJwt } from '../utils/officeJwt.js';
import { addThumbnailJob } from '../queues/thumbnailQueue.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');

// Document format to OnlyOffice Document Type mapping
export function getDocumentType(filename: string): 'word' | 'cell' | 'slide' | null {
  const ext = (filename.split('.').pop() || '').toLowerCase();

  const wordExts = ['doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt', 'html', 'htm', 'epub'];
  const cellExts = ['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv'];
  const slideExts = ['ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'ppsm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp'];

  if (wordExts.includes(ext)) return 'word';
  if (cellExts.includes(ext)) return 'cell';
  if (slideExts.includes(ext)) return 'slide';
  return null;
}

/**
 * Downloads a file buffer from an HTTP or HTTPS URL (from OnlyOffice Document Server)
 */
function fetchBufferFromUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Failed to download file from OnlyOffice: HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', (err) => reject(err));
    }).on('error', (err) => reject(err));
  });
}

// =============================================================================
// 1. Get OnlyOffice Editor Configuration for a File
// =============================================================================
router.get('/office/config/:fileId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userName = req.user!.name || req.user!.email;
    const { fileId } = req.params;

    // Fetch file and verify user access (owner or share recipient)
    const fileRes = await pool.query(
      `SELECT DISTINCT f.id, f.original_name, f.mime_type, f.size, f.updated_at, f.owner_id,
              s.permission as share_permission
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

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileRes.rows[0];
    const docType = getDocumentType(file.original_name);

    if (!docType) {
      res.status(400).json({ error: 'File format is not supported by OnlyOffice Docs' });
      return;
    }

    const ext = (file.original_name.split('.').pop() || '').toLowerCase();
    const isOwner = file.owner_id === userId;
    const canEdit = isOwner || file.share_permission === 'edit';

    // Unique document version key for OnlyOffice caching
    const versionTimestamp = new Date(file.updated_at).getTime();
    const docKey = `${file.id}_${versionTimestamp}`;

    // Base URL resolution: use process.env.BASE_URL or fallback to current request host
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:5001';
    const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;

    // Create secure internal stream & callback tokens
    const streamToken = signOfficeJwt({ fileId, userId, action: 'STREAM_FILE', exp: Math.floor(Date.now() / 1000) + 86400 });
    const callbackToken = signOfficeJwt({ fileId, userId, action: 'SAVE_CALLBACK', exp: Math.floor(Date.now() / 1000) + 86400 });

    const fileUrl = `${baseUrl}/api/office/files/${fileId}/stream?token=${streamToken}`;
    const callbackUrl = `${baseUrl}/api/office/callback/${fileId}?token=${callbackToken}`;

    const config = {
      documentType: docType,
      document: {
        title: file.original_name,
        url: fileUrl,
        fileType: ext,
        key: docKey,
        permissions: {
          edit: canEdit,
          download: true,
          print: true,
          review: canEdit,
          comment: true,
          copy: true,
        },
      },
      editorConfig: {
        mode: canEdit ? 'edit' : 'view',
        lang: 'en',
        callbackUrl: callbackUrl,
        coEditing: {
          mode: 'fast',
          change: true,
        },
        user: {
          id: userId,
          name: userName,
        },
        customization: {
          autosave: true,
          forcesave: true,
          chat: true,
          comments: true,
          compactHeader: true,
          help: false,
          feedback: false,
          toolbarNoTabs: false,
        },
      },
    };

    // Sign the whole configuration payload for OnlyOffice JWT validation
    const token = signOfficeJwt(config);

    res.json({
      config,
      token,
      documentType: docType,
      fileTitle: file.original_name,
      canEdit,
    });
  } catch (error: any) {
    console.error('[Office Config] Error:', error);
    res.status(500).json({ error: 'Failed to generate OnlyOffice editor config' });
  }
});

// =============================================================================
// 2. Stream Decrypted File to OnlyOffice Document Server
// =============================================================================
router.get('/office/files/:fileId/stream', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const token = req.query.token as string | undefined;

    if (!token) {
      res.status(401).json({ error: 'Authorization token required' });
      return;
    }

    const jwtCheck = verifyOfficeJwt(token);
    if (!jwtCheck.valid || jwtCheck.payload?.fileId !== fileId) {
      res.status(403).json({ error: 'Invalid or expired stream token' });
      return;
    }

    const fileRes = await pool.query(
      'SELECT id, original_name, mime_type, uuid_storage_name, encryption_key_wrapped FROM "files" WHERE id = $1 AND deleted_at IS NULL',
      [fileId]
    );

    if (fileRes.rowCount === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = fileRes.rows[0];
    const encryptedFilePath = path.join(filesDir, file.uuid_storage_name);

    if (!fs.existsSync(encryptedFilePath)) {
      res.status(404).json({ error: 'Physical file storage not found' });
      return;
    }

    const fileKey = unwrapKey(file.encryption_key_wrapped);
    const decryptedBuffer = await decryptFileFromDisk(encryptedFilePath, fileKey);

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
    res.send(decryptedBuffer);
  } catch (error: any) {
    console.error('[Office File Stream] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream document to OnlyOffice' });
    }
  }
});

// =============================================================================
// 3. OnlyOffice Save Callback (Handles Status 2: Save & Status 6: ForceSave)
// =============================================================================
router.post('/office/callback/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const tokenFromQuery = req.query.token as string | undefined;
    const tokenFromBody = req.body.token as string | undefined;
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    const token = tokenFromQuery || tokenFromBody || tokenFromHeader;

    if (token) {
      const jwtCheck = verifyOfficeJwt(token);
      if (!jwtCheck.valid) {
        console.warn('[Office Callback] Invalid JWT received:', jwtCheck.error);
      }
    }

    const { status, url } = req.body;
    console.log(`[Office Callback] File: ${fileId}, Status: ${status}`);

    // Status 2 = Document ready for saving, Status 6 = Document editing force-saved
    if ((status === 2 || status === 6) && url) {
      console.log(`[Office Callback] Downloading updated document from ${url}...`);

      const updatedBuffer = await fetchBufferFromUrl(url);

      const fileRes = await pool.query(
        'SELECT id, owner_id, original_name, size, uuid_storage_name, encryption_key_wrapped FROM "files" WHERE id = $1 AND deleted_at IS NULL',
        [fileId]
      );

      if (fileRes.rowCount === 0) {
        res.json({ error: 1, message: 'File not found' });
        return;
      }

      const file = fileRes.rows[0];
      const oldSize = Number(file.size);
      const newSize = updatedBuffer.length;
      const sizeDelta = BigInt(newSize - oldSize);

      // Re-encrypt the updated file with a fresh AES-256-GCM key
      const newFileKey = generateFileKey();
      const wrappedKey = wrapKey(newFileKey);
      const currentStorageName = file.uuid_storage_name;
      const currentEncryptedPath = path.join(filesDir, currentStorageName);

      // Archive current active version snapshot
      const versionStorageName = `${fileId}_v_${Date.now()}.enc`;
      const versionEncryptedPath = path.join(filesDir, versionStorageName);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Copy existing file to version archive if it exists
        if (fs.existsSync(currentEncryptedPath)) {
          await fs.promises.copyFile(currentEncryptedPath, versionEncryptedPath);

          // Get next version number
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
              file.size,
              versionStorageName,
              file.encryption_key_wrapped,
              file.owner_id,
            ]
          );
        }

        // Overwrite active encrypted file on disk
        await encryptFileToDisk(updatedBuffer, currentEncryptedPath, newFileKey);

        // Update database record
        await client.query(
          `UPDATE "files"
           SET "size" = $1, "encryption_key_wrapped" = $2, "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $3`,
          [newSize, wrappedKey, fileId]
        );

        // Adjust user storage quota
        if (sizeDelta !== BigInt(0)) {
          await client.query(
            `UPDATE "user"
             SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" + $1), "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $2`,
            [sizeDelta.toString(), file.owner_id]
          );
        }

        await client.query('COMMIT');

        // Enqueue background thumbnail regeneration
        await addThumbnailJob(fileId);

        await logAudit({
          action: 'FILE_UPLOAD',
          userId: file.owner_id,
          resourceId: fileId,
          resourceType: 'file',
          details: { action: 'OFFICE_EDIT_SAVE', filename: file.original_name, newSize, oldSize },
        });

        console.log(`[Office Callback] Document ${fileId} (${file.original_name}) updated and re-encrypted successfully.`);
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    }

    // OnlyOffice requires response: { "error": 0 }
    res.json({ error: 0 });
  } catch (error: any) {
    console.error('[Office Callback] Error:', error);
    res.json({ error: 1, message: error.message || 'Internal callback error' });
  }
});

export default router;
