import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { auth } from '../auth.js';

const router = Router();

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for avatar
});

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const avatarsDir = path.join(storageBaseDir, 'avatars');
fs.mkdirSync(avatarsDir, { recursive: true });

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// =============================================================================
// 1. Storage Usage & Breakdown by File Category
// =============================================================================
router.get('/account/storage', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user quota & used
    const userRes = await pool.query(
      'SELECT "storageQuotaBytes", "storageUsedBytes" FROM "user" WHERE id = $1',
      [userId]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const quotaBytes = Number(userRes.rows[0].storageQuotaBytes) || 10737418240;
    const usedBytes = Number(userRes.rows[0].storageUsedBytes) || 0;

    // Fetch active files for category breakdown
    const filesRes = await pool.query(
      'SELECT mime_type, original_name, size FROM "files" WHERE owner_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    const categories: Record<string, { bytes: number; count: number; label: string; color: string }> = {
      documents: { bytes: 0, count: 0, label: 'Documents & PDFs', color: '#f59e0b' },
      images: { bytes: 0, count: 0, label: 'Images & Photos', color: '#8b5cf6' },
      videos: { bytes: 0, count: 0, label: 'Videos & Movies', color: '#ef4444' },
      audio: { bytes: 0, count: 0, label: 'Audio & Music', color: '#ec4899' },
      code: { bytes: 0, count: 0, label: 'Code & Text', color: '#06b6d4' },
      archives: { bytes: 0, count: 0, label: 'Archives & ZIPs', color: '#10b981' },
      other: { bytes: 0, count: 0, label: 'Other Files', color: '#6b7280' },
    };

    for (const f of filesRes.rows) {
      const mime = (f.mime_type || '').toLowerCase();
      const ext = (f.original_name.split('.').pop() || '').toLowerCase();
      const size = Number(f.size);

      if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp'].includes(ext)) {
        categories.images.bytes += size;
        categories.images.count++;
      } else if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) {
        categories.videos.bytes += size;
        categories.videos.count++;
      } else if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
        categories.audio.bytes += size;
        categories.audio.count++;
      } else if (mime.includes('pdf') || mime.includes('word') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation') || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) {
        categories.documents.bytes += size;
        categories.documents.count++;
      } else if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed') || ['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
        categories.archives.bytes += size;
        categories.archives.count++;
      } else if (mime.startsWith('text/') || ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'sh', 'md'].includes(ext)) {
        categories.code.bytes += size;
        categories.code.count++;
      } else {
        categories.other.bytes += size;
        categories.other.count++;
      }
    }

    const breakdown = Object.entries(categories).map(([key, val]) => ({
      key,
      label: val.label,
      bytes: val.bytes,
      bytesFormatted: formatBytes(val.bytes),
      count: val.count,
      color: val.color,
      percentage: usedBytes > 0 ? Math.round((val.bytes / usedBytes) * 100) : 0,
    }));

    res.json({
      quotaBytes,
      quotaFormatted: formatBytes(quotaBytes),
      usedBytes,
      usedFormatted: formatBytes(usedBytes),
      usagePercent: quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0,
      totalFiles: filesRes.rowCount || 0,
      breakdown,
    });
  } catch (error: any) {
    console.error('[Storage Stats] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve storage breakdown' });
  }
});

// =============================================================================
// 2. Activity / Audit Log (Paginated for user's own actions)
// =============================================================================
router.get('/account/audit-logs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM "audit_logs" WHERE user_id = $1',
      [userId]
    );

    const totalCount = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const logsRes = await pool.query(
      `SELECT id, action, resource_id, resource_type, ip_address, details, created_at
       FROM "audit_logs"
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const logs = logsRes.rows.map((log) => ({
      id: log.id,
      action: log.action,
      resourceId: log.resource_id,
      resourceType: log.resource_type,
      ipAddress: log.ip_address,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
      createdAt: log.created_at,
    }));

    res.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('[Audit Logs] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve activity log' });
  }
});

// =============================================================================
// 3. Change Password
// =============================================================================
router.post('/account/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long' });
      return;
    }

    // Call better-auth changePassword API endpoint internally
    const changeRes = await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: req.headers as any,
    });

    if (!changeRes) {
      res.status(400).json({ error: 'Failed to change password. Please verify your current password.' });
      return;
    }

    await logAudit({
      action: 'AUTH_LOGIN',
      userId: req.user!.id,
      resourceId: req.user!.id,
      resourceType: 'user',
      ipAddress: req.ip,
      details: { action: 'PASSWORD_CHANGED' },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('[Change Password] Error:', error);
    res.status(400).json({ error: error.message || 'Failed to change password' });
  }
});

// =============================================================================
// 4. Update Profile Info and Profile Picture
// =============================================================================
router.patch('/account/profile', requireAuth, (req: AuthenticatedRequest, res: Response, next) => {
  uploadMemory.single('avatar')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Profile picture exceeds the 5MB size limit' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Failed to parse upload file' });
    }
    next();
  });
}, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, phoneNumber, birthdate } = req.body;

    let cleanPhone = phoneNumber;
    if (phoneNumber !== undefined) {
      if (phoneNumber && phoneNumber.trim() !== '') {
        cleanPhone = phoneNumber.trim();
        const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
        if (!phoneRegex.test(cleanPhone)) {
          res.status(400).json({ error: 'Please enter a valid phone number (e.g. +1 555-0199)' });
          return;
        }
      } else {
        cleanPhone = null;
      }
    } else {
      cleanPhone = (req.user as any).phoneNumber || null;
    }

    let cleanBirthdate = birthdate;
    if (birthdate !== undefined) {
      if (birthdate && birthdate.trim() !== '') {
        cleanBirthdate = birthdate.trim();
        const parsedDate = Date.parse(cleanBirthdate);
        if (isNaN(parsedDate)) {
          res.status(400).json({ error: 'Please enter a valid birthdate (YYYY-MM-DD)' });
          return;
        }
      } else {
        cleanBirthdate = null;
      }
    } else {
      cleanBirthdate = (req.user as any).birthdate || null;
    }

    let imageUrl = req.user!.image || null;

    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.png';
      const avatarName = `${userId}${ext}`;
      const avatarPath = path.join(avatarsDir, avatarName);
      await fs.promises.writeFile(avatarPath, req.file.buffer);
      imageUrl = `/api/avatar/${userId}?t=${Date.now()}`;
    }

    await pool.query(
      `UPDATE "user"
       SET name = COALESCE($1, name),
           "phoneNumber" = $2,
           birthdate = $3,
           image = COALESCE($4, image),
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [name || null, cleanPhone, cleanBirthdate, imageUrl, userId]
    );

    await logAudit({
      action: 'USER_UPDATE_PROFILE',
      userId,
      resourceId: userId,
      resourceType: 'user',
      ipAddress: req.ip,
      details: { name, phoneNumber, birthdate, hasAvatar: !!req.file },
    });

    res.json({ message: 'Profile updated successfully', imageUrl });
  } catch (error: any) {
    console.error('[Update Profile] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile info' });
  }
});

export default router;
