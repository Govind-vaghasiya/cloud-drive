import { Queue, Worker } from 'bullmq';
import path from 'path';
import fs from 'fs';
import { redisConnectionOptions, checkRedisConnection } from '../redis.js';
import { pool } from '../db.js';
import { logAudit } from '../services/audit.js';

export const TRASH_PURGE_QUEUE_NAME = 'trash-auto-purge';

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');
const thumbnailsDir = path.join(storageBaseDir, 'thumbnails');

let trashQueue: Queue | null = null;
let trashWorker: Worker | null = null;

/**
 * Core purge function that permanently removes files soft-deleted > 30 days ago
 */
export async function purgeExpiredTrash(): Promise<{ filesPurged: number; foldersPurged: number; bytesReclaimed: bigint }> {
  console.log('[Trash Purge] Running 30-day trash auto-cleanup...');
  const client = await pool.connect();
  let filesPurged = 0;
  let foldersPurged = 0;
  let bytesReclaimed = BigInt(0);

  try {
    await client.query('BEGIN');

    // 1. Find all files soft-deleted more than 30 days ago
    const expiredFilesRes = await client.query(
      `SELECT id, owner_id, uuid_storage_name, size, thumbnail_path, original_name
       FROM "files"
       WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'`
    );

    const expiredFiles = expiredFilesRes.rows;

    for (const f of expiredFiles) {
      filesPurged++;
      const sizeBigInt = BigInt(f.size);
      bytesReclaimed += sizeBigInt;

      const fPath = path.join(filesDir, f.uuid_storage_name);
      const tPath = path.join(thumbnailsDir, `${f.id}.webp`);

      // Unlink from disk
      await fs.promises.unlink(fPath).catch(() => {});
      await fs.promises.unlink(tPath).catch(() => {});

      // Delete DB row
      await client.query('DELETE FROM "files" WHERE id = $1', [f.id]);

      // Decrement user storage
      await client.query(
        'UPDATE "user" SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" - $1), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
        [f.size, f.owner_id]
      );
    }

    // 2. Find and delete all folders soft-deleted more than 30 days ago
    const expiredFoldersRes = await client.query(
      `DELETE FROM "folders"
       WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'
       RETURNING id`
    );

    foldersPurged = expiredFoldersRes.rowCount || 0;

    await client.query('COMMIT');

    if (filesPurged > 0 || foldersPurged > 0) {
      console.log(`[Trash Purge] Purged ${filesPurged} files and ${foldersPurged} folders (Reclaimed ${bytesReclaimed.toString()} bytes).`);
      await logAudit({
        action: 'FILE_DELETE',
        userId: null,
        resourceId: null,
        resourceType: 'system',
        details: { action: 'AUTO_PURGE_30_DAYS', filesPurged, foldersPurged, bytesReclaimed: bytesReclaimed.toString() },
      });
    } else {
      console.log('[Trash Purge] No expired trash items to purge.');
    }

    return { filesPurged, foldersPurged, bytesReclaimed };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Trash Purge] Error running trash purge:', error);
    throw error;
  } finally {
    client.release();
  }
}

export function getTrashPurgeQueue(): Queue | null {
  if (!trashQueue) {
    try {
      trashQueue = new Queue(TRASH_PURGE_QUEUE_NAME, {
        connection: redisConnectionOptions,
      });

      trashQueue.on('error', () => {});
    } catch (error: any) {
      console.warn('[Trash Queue] Could not initialize BullMQ Queue:', error?.message);
    }
  }
  return trashQueue;
}

/**
 * Initializes the BullMQ Worker and sets up daily cron job (0 0 * * *)
 */
export async function initTrashPurgeScheduler() {
  const redisStatus = await checkRedisConnection();

  if (redisStatus.connected) {
    try {
      const queue = getTrashPurgeQueue();
      if (queue) {
        // Add repeatable daily cron job at midnight
        if (typeof (queue as any).upsertJobScheduler === 'function') {
          await (queue as any).upsertJobScheduler('daily-trash-purge-cron', {
            pattern: '0 0 * * *',
          });
        } else {
          await (queue.add as any)(
            'daily-trash-purge',
            {},
            {
              repeat: {
                pattern: '0 0 * * *',
              },
              jobId: 'daily-trash-purge-cron',
            }
          );
        }
      }

      trashWorker = new Worker(
        TRASH_PURGE_QUEUE_NAME,
        async () => {
          await purgeExpiredTrash();
        },
        {
          connection: redisConnectionOptions,
        }
      );

      trashWorker.on('completed', () => {
        console.log('[Trash Purge Worker] Auto-purge job completed successfully');
      });

      trashWorker.on('failed', (_, err) => {
        console.error('[Trash Purge Worker] Auto-purge job failed:', err.message);
      });

      console.log('[Trash Purge Worker] Scheduled 30-day trash auto-purge (daily cron: 0 0 * * *)');
      return;
    } catch (err: any) {
      console.warn('[Trash Purge Worker] Redis setup warning:', err.message);
    }
  }

  // Fallback: Run purge check on startup in background and set daily interval
  setImmediate(() => {
    purgeExpiredTrash().catch(() => {});
  });

  // Daily interval fallback (24 hours)
  setInterval(() => {
    purgeExpiredTrash().catch(() => {});
  }, 24 * 60 * 60 * 1000);
}

export async function closeTrashPurgeQueue(): Promise<void> {
  try {
    if (trashWorker) {
      await trashWorker.close();
      trashWorker = null;
    }
    if (trashQueue) {
      await trashQueue.close();
      trashQueue = null;
    }
  } catch (error) {
    // Ignore close errors
  }
}
