import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  console.log('[Database] Checking & running database migrations...');
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "appliedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    let migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(process.cwd(), 'src', 'db', 'migrations');
    }
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Database] No migrations directory found, skipping.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await client.query(
        'SELECT "id" FROM "_migrations" WHERE "name" = $1',
        [file]
      );

      if (existing.rowCount === 0) {
        console.log(`[Database] Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO "_migrations" ("name") VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[Database] Successfully applied migration: ${file}`);
      }
    }
    console.log('[Database] All migrations are up to date.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Database] Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow direct execution via node / tsx
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
