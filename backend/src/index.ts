import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { checkDatabaseConnection, pool } from './db.js';
import { checkRedisConnection } from './redis.js';
import { runMigrations } from './db/migrate.js';
import authExtendedRouter from './routes/auth-extended.js';
import uploadRouter from './routes/upload.js';
import foldersRouter from './routes/folders.js';
import filesRouter from './routes/files.js';
import sharesRouter from './routes/shares.js';
import trashRouter from './routes/trash.js';
import searchRouter from './routes/search.js';
import accountRouter from './routes/account.js';
import officeRouter from './routes/office.js';
import favoritesRouter from './routes/favorites.js';
import versionsRouter from './routes/versions.js';
// Batch resources operation endpoints
import batchRouter from './routes/batch.js';
import { initThumbnailWorker } from './queues/thumbnailQueue.js';
import { initTrashPurgeScheduler } from './queues/trashPurgeQueue.js';
import { authRateLimiter, publicShareRateLimiter } from './middleware/rateLimit.js';
import { loadAndValidateConfig } from './config.js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '5001', 10);

// Validate environment on startup
loadAndValidateConfig();

// CORS configuration for local development and domain
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://localhost:5001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5001',
    'https://drive2.govindvaghasiya.ca',
    'http://drive2.govindvaghasiya.ca',
  ],
  credentials: true,
}));

// Enforce single-use invite passcode (OTP) on user registration (exempting initial admin setup)
app.all(['/api/auth/sign-up/email', '/api/auth/email/sign-up'], express.json(), async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'POST') return next();
  try {
    const countResult = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(countResult.rows[0]?.count || '0', 10);

    // Initial setup user (user 0) is exempt
    if (userCount === 0) {
      return next();
    }

    const { inviteCode } = req.body || {};
    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim() === '') {
      res.status(400).json({ error: 'Registration is invite-only. A single-use invite passcode (OTP) is required.' });
      return;
    }

    const cleanCode = inviteCode.trim();
    const codeRes = await pool.query(
      'SELECT id, used_at, expires_at FROM "invite_codes" WHERE "code" = $1',
      [cleanCode]
    );

    if (codeRes.rowCount === 0) {
      res.status(400).json({ error: 'Invalid invite passcode' });
      return;
    }

    const codeRow = codeRes.rows[0];
    if (codeRow.used_at) {
      res.status(400).json({ error: 'This invite passcode has already been used' });
      return;
    }

    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'This invite passcode has expired' });
      return;
    }

    // Code is valid and active! Proceed to signup
    next();
  } catch (err) {
    console.error('[Invite Validation Middleware Error]', err);
    res.status(500).json({ error: 'Failed to validate invite passcode' });
  }
});

// Public check if the app is a fresh install (0 users)
// IMPORTANT: Must be registered BEFORE the Better-Auth wildcard handler below,
// otherwise /api/auth/* swallows this route.
app.get('/api/auth/is-fresh-install', async (req: Request, res: Response) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(countResult.rows[0]?.count || '0', 10);
    res.json({ fresh: userCount === 0 });
  } catch (err) {
    res.json({ fresh: false });
  }
});

// Public: Validate invite passcode BEFORE Better-Auth wildcard (which would swallow this route)
app.post('/api/auth/validate-invite-code', express.json(), async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const countResult = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(countResult.rows[0]?.count || '0', 10);

    // First user (initial admin) is exempt from invite codes
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
    console.error('[validate-invite-code]', error);
    res.status(500).json({ valid: false, error: 'Failed to validate invite passcode. Please try again.' });
  }
});

// Mount Better-Auth handler directly before express.json() for raw body processing if needed
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

// Mount API routers
app.use('/api', authExtendedRouter);
app.use('/api', uploadRouter);
app.use('/api', foldersRouter);
app.use('/api', filesRouter);
app.use('/api', sharesRouter);
app.use('/api', trashRouter);
app.use('/api', searchRouter);
app.use('/api', accountRouter);
app.use('/api', officeRouter);
app.use('/api', favoritesRouter);
app.use('/api', versionsRouter);
app.use('/api', batchRouter);

// Dev/Admin helper: return most recent simulated password reset URL from file
// This exists because email sending is simulated (logged to file) rather than sent via SMTP
app.get('/api/auth/debug/last-reset-url', async (req: Request, res: Response) => {
  try {
    const filePath = path.join(process.cwd(), 'data', 'storage', 'password_resets.json');
    if (!fs.existsSync(filePath)) {
      res.json({ url: null });
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const resets = JSON.parse(content || '[]');
    if (!resets.length) {
      res.json({ url: null });
      return;
    }
    const last = resets[resets.length - 1];
    res.json({ url: last.url, email: last.email, timestamp: last.timestamp });
  } catch (err) {
    res.json({ url: null });
  }
});

// Base placeholder endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Hello Cloud Drive',
    domain: process.env.APP_DOMAIN || 'drive2.govindvaghasiya.ca',
    version: '0.2.0 (Phase 1 — Auth & DB)',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint for Postgres, Redis, and Backend
app.get(['/health', '/api/health'], async (req: Request, res: Response) => {
  const [dbStatus, redisStatus] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
  ]);

  const allHealthy = dbStatus.connected && redisStatus.connected;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      backend: { status: 'healthy' },
      postgres: {
        status: dbStatus.connected ? 'healthy' : 'unhealthy',
        message: dbStatus.message,
      },
      redis: {
        status: redisStatus.connected ? 'healthy' : 'unhealthy',
        message: redisStatus.message,
      },
    },
  });
});

// Placeholder API info endpoint
app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    app: 'Cloud Drive',
    version: 'Phase 1 — Database Schema & Auth Foundation',
    authSystem: 'better-auth with PostgreSQL & 2FA (Active)',
    storageEncryption: 'AES-256-GCM (Pending Phase 2)',
    officeEditor: 'OnlyOffice Docs (Pending Phase 7)',
  });
});

async function seedDefaultAdmin() {
  try {
    const countRes = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(countRes.rows[0]?.count || '0', 10);
    if (userCount === 0) {
      console.log('[Seed] Seeding default admin user (govind@admin.com)...');
      await auth.api.signUpEmail({
        body: {
          name: 'Govind Vaghasiya',
          email: 'govind@admin.com',
          password: 'admin',
        },
      });
      // Ensure the role is admin in database
      await pool.query('UPDATE "user" SET role = \'admin\' WHERE email = $1', ['govind@admin.com']);
      console.log('[Seed] Default admin user seeded successfully.');
    }
  } catch (err: any) {
    console.error('[Seed] Failed to seed default admin:', err.message);
  }
}

// Server Initialization
async function startServer() {
  try {
    // Check DB and run migrations
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      await runMigrations();
      await seedDefaultAdmin();
    } else {
      console.warn('[Database] Initial connection check failed. Will retry on request.');
    }

    // Initialize background job queue worker for thumbnails & trash auto-purge
    initThumbnailWorker();
    initTrashPurgeScheduler();
  } catch (error) {
    console.error('[Initialization] Error during server initialization:', error);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Cloud Drive Backend] Server running on http://0.0.0.0:${port}`);
    console.log(`[Cloud Drive Backend] Domain target: ${process.env.APP_DOMAIN || 'drive2.govindvaghasiya.ca'}`);
  });
}

startServer();
