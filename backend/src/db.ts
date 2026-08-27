import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'cloud_drive',
  user: process.env.DB_USER || 'cloud_drive_user',
  password: process.env.DB_PASSWORD || 'dev_secret_password_123!',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function checkDatabaseConnection(): Promise<{ connected: boolean; message?: string }> {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now');
    client.release();
    return { connected: true, message: `PostgreSQL connected successfully at ${res.rows[0].now}` };
  } catch (error: any) {
    return { connected: false, message: error?.message || 'Failed to connect to PostgreSQL' };
  }
}
