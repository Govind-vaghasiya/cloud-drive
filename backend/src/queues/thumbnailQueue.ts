import { Queue, Worker, Job } from 'bullmq';
import { redisConnectionOptions, checkRedisConnection } from '../redis.js';
import { generateThumbnail } from '../services/thumbnail.js';

export const THUMBNAIL_QUEUE_NAME = 'thumbnail-generation';

interface ThumbnailJobData {
  fileId: string;
}

let thumbnailQueue: Queue<ThumbnailJobData> | null = null;
let thumbnailWorker: Worker<ThumbnailJobData> | null = null;

export function getThumbnailQueue(): Queue<ThumbnailJobData> | null {
  if (!thumbnailQueue) {
    try {
      thumbnailQueue = new Queue<ThumbnailJobData>(THUMBNAIL_QUEUE_NAME, {
        connection: redisConnectionOptions,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600,
            count: 500,
          },
          removeOnFail: {
            age: 86400,
            count: 1000,
          },
        },
      });

      thumbnailQueue.on('error', (err) => {
        // Log once or quietly if Redis is temporarily offline
      });
    } catch (error: any) {
      console.warn('[BullMQ] Could not initialize BullMQ Queue:', error?.message);
    }
  }
  return thumbnailQueue;
}

/**
 * Initializes the BullMQ Worker to process thumbnail generation tasks
 */
export async function initThumbnailWorker() {
  if (thumbnailWorker) return thumbnailWorker;

  const redisStatus = await checkRedisConnection();
  if (!redisStatus.connected) {
    console.log('[BullMQ Worker] Redis is not connected yet. Background worker will start when Redis becomes available.');
    return null;
  }

  try {
    thumbnailWorker = new Worker<ThumbnailJobData>(
      THUMBNAIL_QUEUE_NAME,
      async (job: Job<ThumbnailJobData>) => {
        const { fileId } = job.data;
        console.log(`[BullMQ Worker] Processing thumbnail job for fileId: ${fileId} (Job ID: ${job.id})`);
        const result = await generateThumbnail(fileId);
        return { fileId, thumbnailPath: result };
      },
      {
        connection: redisConnectionOptions,
        concurrency: 4,
      }
    );

    thumbnailWorker.on('completed', (job) => {
      console.log(`[BullMQ Worker] Thumbnail completed for file: ${job.data.fileId}`);
    });

    thumbnailWorker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker] Thumbnail failed for file: ${job?.data.fileId}. Error:`, err.message);
    });

    thumbnailWorker.on('error', (err) => {
      // Quiet worker reconnect
    });

    console.log('[BullMQ Worker] Thumbnail worker started successfully');
    return thumbnailWorker;
  } catch (error: any) {
    console.warn('[BullMQ Worker] Could not start worker:', error?.message);
    return null;
  }
}

/**
 * Enqueues a thumbnail generation job.
 * If the queue/Redis is not reachable, executes generation asynchronously in-process.
 */
export async function addThumbnailJob(fileId: string): Promise<void> {
  if (!fileId) return;

  const queue = getThumbnailQueue();
  if (queue) {
    try {
      await queue.add('generate-thumbnail', { fileId });
      console.log(`[BullMQ] Enqueued thumbnail job for file: ${fileId}`);
      return;
    } catch (err: any) {
      // Redis unavailable or queue error -> fall back to async generation
    }
  }

  // Fallback: run async in background without blocking upload response
  setImmediate(() => {
    generateThumbnail(fileId).catch((err) => {
      console.error(`[Thumbnail Fallback] Error generating thumbnail for ${fileId}:`, err);
    });
  });
}

/**
 * Gracefully close queue and worker
 */
export async function closeThumbnailQueue(): Promise<void> {
  try {
    if (thumbnailWorker) {
      await thumbnailWorker.close();
      thumbnailWorker = null;
    }
    if (thumbnailQueue) {
      await thumbnailQueue.close();
      thumbnailQueue = null;
    }
  } catch (error) {
    // Ignore close errors during shutdown
  }
}
