import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';
import { auth } from '../auth.js';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const avatarsDir = path.join(storageBaseDir, 'avatars');

// =============================================================================
// Current User Profile & Quota
// =============================================================================
router.get('/user/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await pool.query(
      'SELECT id, name, email, role, image, "phoneNumber", "birthdate", "storageQuotaBytes", "storageUsedBytes", "twoFactorEnabled", "createdAt" FROM "user" WHERE id = $1',
      [userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        phoneNumber: user.phoneNumber,
        birthdate: user.birthdate,
        storageQuotaBytes: Number(user.storageQuotaBytes),
        storageUsedBytes: Number(user.storageUsedBytes),
        storageQuotaFormatted: formatBytes(Number(user.storageQuotaBytes)),
        storageUsedFormatted: formatBytes(Number(user.storageUsedBytes)),
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[API /user/me] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

// Serve User Profile Avatar Images
router.get('/avatar/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!fs.existsSync(avatarsDir)) {
      res.status(404).send('Avatar not found');
      return;
    }
    const files = await fs.promises.readdir(avatarsDir);
    const avatarFile = files.find((f) => f.startsWith(userId));
    if (avatarFile) {
      res.sendFile(path.resolve(path.join(avatarsDir, avatarFile)));
      return;
    }
  } catch (err) {
    console.error('Error serving avatar:', err);
  }
  res.status(404).send('Avatar not found');
});

// =============================================================================
// 2FA QR Code Generator Helper
// =============================================================================
router.post('/auth/2fa/qr', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { totpURI } = req.body;
    if (!totpURI) {
      res.status(400).json({ error: 'totpURI is required' });
      return;
    }

    const qrDataURL = await QRCode.toDataURL(totpURI, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    res.json({ qrCode: qrDataURL });
  } catch (error: any) {
    console.error('[API /auth/2fa/qr] Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// =============================================================================
// Admin User Management & Custom Quota Allocation
// =============================================================================
router.get('/admin/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.banned, u."banReason", u."storageQuotaBytes", u."storageUsedBytes", u."twoFactorEnabled", u."createdAt",
              (SELECT COUNT(*) FROM "files" f WHERE f.owner_id = u.id) as files_count,
              (SELECT COUNT(*) FROM "folders" fld WHERE fld.owner_id = u.id) as folders_count
       FROM "user" u 
       ORDER BY u."createdAt" ASC`
    );

    const users = result.rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      banned: Boolean(u.banned),
      banReason: u.banReason || null,
      storageQuotaBytes: Number(u.storageQuotaBytes),
      storageUsedBytes: Number(u.storageUsedBytes),
      storageQuotaFormatted: formatBytes(Number(u.storageQuotaBytes)),
      storageUsedFormatted: formatBytes(Number(u.storageUsedBytes)),
      twoFactorEnabled: u.twoFactorEnabled,
      filesCount: Number(u.files_count || 0),
      foldersCount: Number(u.folders_count || 0),
      createdAt: u.createdAt,
    }));

    res.json({ users });
  } catch (error: any) {
    console.error('[API /admin/users] Error listing users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin Action: Suspend / Unsuspend User
router.patch('/admin/user/:userId/status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { banned, banReason } = req.body;

    if (typeof banned !== 'boolean') {
      res.status(400).json({ error: 'Field "banned" (boolean) is required' });
      return;
    }

    if (req.user!.id === userId && banned) {
      res.status(400).json({ error: 'You cannot suspend your own admin account' });
      return;
    }

    const result = await pool.query(
      'UPDATE "user" SET banned = $1, "banReason" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, name, email, banned, "banReason"',
      [banned, banned ? (banReason || 'Suspended by administrator') : null, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // If suspending user, revoke all active sessions immediately
    if (banned) {
      await pool.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
    }

    res.json({
      message: banned ? 'User account suspended successfully' : 'User account unsuspended successfully',
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('[API /admin/user/status] Error updating status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Admin Action: Delete User Account
router.delete('/admin/user/:userId', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (req.user!.id === userId) {
      res.status(400).json({ error: 'You cannot delete your own admin account' });
      return;
    }

    const userRes = await pool.query('SELECT id, name, email FROM "user" WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetUser = userRes.rows[0];

    // Delete user sessions, shares, files, and user record
    await pool.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
    await pool.query('DELETE FROM "account" WHERE "userId" = $1', [userId]);
    await pool.query('DELETE FROM "shares" WHERE owner_id = $1', [userId]);
    await pool.query('DELETE FROM "files" WHERE owner_id = $1', [userId]);
    await pool.query('DELETE FROM "folders" WHERE owner_id = $1', [userId]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [userId]);

    res.json({
      message: `User account for ${targetUser.name} (${targetUser.email}) was permanently removed`,
    });
  } catch (error: any) {
    console.error('[API /admin/user/delete] Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Admin Action: Reset User Password
router.post('/admin/user/:userId/reset-password', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 5) {
      res.status(400).json({ error: 'Password must be at least 5 characters long' });
      return;
    }

    // Call Better Auth's internal admin set password API
    await auth.api.setUserPassword({
      body: {
        userId,
        newPassword,
      },
    });

    res.json({ message: 'User password reset successfully' });
  } catch (error: any) {
    console.error('[API /admin/user/reset-password] Error resetting password:', error);
    res.status(500).json({ error: error.message || 'Failed to reset user password' });
  }
});

// Admin Action: List Simulated Password Resets
router.get('/admin/password-resets', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = path.join(process.cwd(), 'data', 'storage', 'password_resets.json');
    let resets = [];
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      resets = JSON.parse(content || '[]');
    }
    res.json({ resets });
  } catch (error: any) {
    console.error('[API /admin/password-resets] Error reading resets:', error);
    res.status(500).json({ error: 'Failed to retrieve password resets' });
  }
});

// Admin Action: Clear Simulated Password Resets
router.post('/admin/password-resets/clear', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = path.join(process.cwd(), 'data', 'storage', 'password_resets.json');
    if (fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, '[]');
    }
    res.json({ message: 'Simulated password resets cleared successfully' });
  } catch (error: any) {
    console.error('[API /admin/password-resets/clear] Error clearing resets:', error);
    res.status(500).json({ error: 'Failed to clear password resets' });
  }
});

// Admin Action: Create User Account Directly
router.post('/admin/create-user', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, role, storageQuotaGb } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    // Check existing email
    const existing = await pool.query('SELECT id FROM "user" WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rowCount! > 0) {
      res.status(400).json({ error: 'A user account with this email address already exists' });
      return;
    }

    // Register user via better-auth
    const userRes = await auth.api.signUpEmail({
      body: {
        email: email.toLowerCase().trim(),
        password,
        name,
      },
    });

    if (!userRes || !userRes.user) {
      res.status(400).json({ error: 'Failed to create user account' });
      return;
    }

    const userId = userRes.user.id;
    const targetRole = role === 'admin' ? 'admin' : 'user';
    const quotaBytes = storageQuotaGb ? Math.round(Number(storageQuotaGb) * 1024 * 1024 * 1024) : 107374182400;

    await pool.query(
      'UPDATE "user" SET role = $1, "storageQuotaBytes" = $2 WHERE id = $3',
      [targetRole, quotaBytes, userId]
    );

    res.json({
      message: `User account for ${name} (${email}) created successfully`,
      user: {
        id: userId,
        name,
        email,
        role: targetRole,
        storageQuotaBytes: quotaBytes,
        storageQuotaFormatted: formatBytes(quotaBytes),
      },
    });
  } catch (error: any) {
    console.error('[API /admin/create-user] Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user account' });
  }
});

router.patch('/admin/user/:userId/quota', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { storageQuotaBytes } = req.body;

    if (typeof storageQuotaBytes !== 'number' || storageQuotaBytes < 0) {
      res.status(400).json({ error: 'Valid storageQuotaBytes (positive number) is required' });
      return;
    }

    const result = await pool.query(
      'UPDATE "user" SET "storageQuotaBytes" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, "storageQuotaBytes"',
      [storageQuotaBytes, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updated = result.rows[0];
    res.json({
      message: 'Storage quota updated successfully',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        storageQuotaBytes: Number(updated.storageQuotaBytes),
        storageQuotaFormatted: formatBytes(Number(updated.storageQuotaBytes)),
      },
    });
  } catch (error: any) {
    console.error('[API /admin/user/quota] Error updating quota:', error);
    res.status(500).json({ error: 'Failed to update storage quota' });
  }
});

router.patch('/admin/user/:userId/role', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      res.status(400).json({ error: "Role must be 'user' or 'admin'" });
      return;
    }

    const result = await pool.query(
      'UPDATE "user" SET role = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, role',
      [role, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: `User role updated to ${role}`,
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('[API /admin/user/role] Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// =============================================================================
// Admin One-Time Invite Code (OTP) Generator & Management
// =============================================================================

// 1. Generate new single-use Invite OTP Code
router.post('/admin/invite-code', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { expiresInMinutes = 60 } = req.body;
    const duration = Math.min(1440, Math.max(1, Number(expiresInMinutes) || 60)); // 1 min to 24 hrs (1440 mins)

    // Generate random 6-digit numeric OTP code
    const crypto = await import('crypto');
    const code = crypto.randomInt(100000, 999999).toString();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    await pool.query(
      `INSERT INTO "invite_codes" (id, code, created_by, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, code, adminId, expiresAt]
    );

    res.json({
      message: 'Invite code generated successfully',
      inviteCode: {
        id,
        code,
        expiresInMinutes: duration,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[API /admin/invite-code] Error generating code:', error);
    res.status(500).json({ error: 'Failed to generate invite code' });
  }
});

// 2. List all Invite Codes
router.get('/admin/invite-codes', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT ic.id, ic.code, ic.created_at, ic.expires_at, ic.used_at,
              u_creator.name as creator_name,
              u_user.name as user_name, u_user.email as user_email
       FROM "invite_codes" ic
       LEFT JOIN "user" u_creator ON u_creator.id = ic.created_by
       LEFT JOIN "user" u_user ON u_user.id = ic.used_by
       ORDER BY ic.created_at DESC
       LIMIT 100`
    );

    const now = Date.now();
    const inviteCodes = result.rows.map((row) => {
      let status: 'ACTIVE' | 'USED' | 'EXPIRED' = 'ACTIVE';
      if (row.used_at) {
        status = 'USED';
      } else if (new Date(row.expires_at).getTime() < now) {
        status = 'EXPIRED';
      }

      return {
        id: row.id,
        code: row.code,
        status,
        creatorName: row.creator_name || 'Admin',
        usedByName: row.user_name || null,
        usedByEmail: row.user_email || null,
        usedAt: row.used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      };
    });

    res.json({ inviteCodes });
  } catch (error: any) {
    console.error('[API /admin/invite-codes] Error fetching codes:', error);
    res.status(500).json({ error: 'Failed to fetch invite codes' });
  }
});

// 3. Revoke/Delete an Invite Code
router.delete('/admin/invite-code/:codeId', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { codeId } = req.params;
    await pool.query('DELETE FROM "invite_codes" WHERE id = $1', [codeId]);
    res.json({ message: 'Invite code revoked successfully' });
  } catch (error: any) {
    console.error('[API /admin/invite-code/delete] Error deleting code:', error);
    res.status(500).json({ error: 'Failed to revoke invite code' });
  }
});

// 4. Public Endpoint: Validate an Invite OTP Code before Signup
router.post('/auth/validate-invite-code', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    // Check if initial admin setup user
    const countResult = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(countResult.rows[0]?.count || '0', 10);

    if (userCount === 0) {
      res.json({ valid: true, isFirstUser: true, message: 'Initial Admin Setup Exempt' });
      return;
    }

    if (!code || typeof code !== 'string' || code.trim() === '') {
      res.status(400).json({ valid: false, error: 'Invite passcode is required' });
      return;
    }

    const cleanCode = code.trim();
    const result = await pool.query(
      'SELECT id, used_at, expires_at FROM "invite_codes" WHERE "code" = $1',
      [cleanCode]
    );

    if (result.rowCount === 0) {
      res.status(400).json({ valid: false, error: 'Invalid invite passcode' });
      return;
    }

    const row = result.rows[0];
    if (row.used_at) {
      res.status(400).json({ valid: false, error: 'This invite passcode has already been used' });
      return;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      res.status(400).json({ valid: false, error: 'This invite passcode has expired' });
      return;
    }

    res.json({ valid: true, expiresAt: row.expires_at });
  } catch (error: any) {
    console.error('[Validate Invite Code] Error:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate invite code' });
  }
});

// Helper: Format bytes to human readable string
function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default router;
