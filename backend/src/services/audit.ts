import { pool } from '../db.js';

export type AuditAction = 
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'FILE_DELETE'
  | 'FILE_RENAME'
  | 'FILE_MOVE'
  | 'FILE_EDIT'
  | 'FOLDER_CREATE'
  | 'FOLDER_DELETE'
  | 'FOLDER_RENAME'
  | 'FOLDER_MOVE'
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_2FA_ENABLE'
  | 'AUTH_2FA_DISABLE'
  | 'ADMIN_QUOTA_UPDATE'
  | 'SHARE_CREATE'
  | 'SHARE_REVOKE'
  | 'PUBLIC_SHARE_DOWNLOAD'
  | 'USER_UPDATE_PROFILE'
  | 'BATCH_MOVE'
  | 'BATCH_DELETE'
  | 'BATCH_COPY';

export interface AuditLogOptions {
  action: AuditAction;
  userId?: string | null;
  resourceId?: string | null;
  resourceType?: 'file' | 'folder' | 'user' | 'system' | 'batch';
  ipAddress?: string | null;
  details?: Record<string, any> | null;
}

export async function logAudit(options: AuditLogOptions): Promise<void> {
  try {
    const { action, userId, resourceId, resourceType, ipAddress, details } = options;
    await pool.query(
      `INSERT INTO "audit_logs" ("action", "user_id", "resource_id", "resource_type", "ip_address", "details")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        action,
        userId || null,
        resourceId || null,
        resourceType || null,
        ipAddress || null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (error) {
    console.error('[Audit Log] Error writing audit log:', error);
  }
}
