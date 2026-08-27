import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

export const redisConnectionOptions = {
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
};

export const redis = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: 2,
  retryStrategy(times: number) {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 100, 2000);
  },
  lazyConnect: true,
});

export async function checkRedisConnection(): Promise<{ connected: boolean; message?: string }> {
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const pong = await redis.ping();
    return { connected: pong === 'PONG', message: `Redis connected (PING -> ${pong})` };
  } catch (error: any) {
    return { connected: false, message: error?.message || 'Failed to connect to Redis' };
  }
}

