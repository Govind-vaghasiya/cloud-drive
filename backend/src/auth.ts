import { betterAuth } from 'better-auth';
import { twoFactor, admin } from 'better-auth/plugins';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

dotenv.config();

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET || 'dev_secret_auth_32_characters_long_key_123',
  baseURL: process.env.BASE_URL || 'http://localhost:5001',
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:5000',
    'http://localhost:5001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5001',
    'https://drive2.govindvaghasiya.ca',
    'http://drive2.govindvaghasiya.ca',
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 5,
    sendResetPassword: async (data) => {
      console.log(`[SIMULATED EMAIL] Password reset requested for ${data.user.email}. Link: ${data.url}`);
      try {
        const filePath = path.join(process.cwd(), 'data', 'storage', 'password_resets.json');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        let resets = [];
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          resets = JSON.parse(content || '[]');
        }
        
        resets.push({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          url: data.url,
          timestamp: new Date().toISOString(),
        });
        
        fs.writeFileSync(filePath, JSON.stringify(resets, null, 2));
      } catch (err) {
        console.error('[SIMULATED EMAIL] Failed to save password reset to file:', err);
      }
    }
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        required: false,
      },
      storageQuotaBytes: {
        type: 'number',
        defaultValue: 10737418240, // 10 GB
        required: false,
      },
      storageUsedBytes: {
        type: 'number',
        defaultValue: 0,
        required: false,
      },
      phoneNumber: {
        type: 'string',
        required: false,
      },
      birthdate: {
        type: 'string',
        required: false,
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: 'Cloud Drive',
      otpOptions: {
        digits: 6,
        period: 30,
      },
    }),
    admin(),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'cloud_drive',
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // If this is the very first user in the database, promote to 'admin'
          try {
            const countResult = await pool.query('SELECT COUNT(*) as count FROM "user"');
            const userCount = parseInt(countResult.rows[0]?.count || '0', 10);
            if (userCount === 0) {
              return {
                data: {
                  ...user,
                  role: 'admin',
                  storageQuotaBytes: 107374182400, // 100 GB for initial admin
                },
              };
            }
          } catch (e) {
            console.error('[Auth] Error determining user count:', e);
          }
          return { data: user };
        },
        after: async (user: any, ctx: any) => {
          // Mark the exact submitted invite code as used
          try {
            const submittedCode = ctx?.body?.inviteCode ? String(ctx.body.inviteCode).trim() : null;
            if (submittedCode) {
              await pool.query(
                `UPDATE "invite_codes" 
                 SET "used_by" = $1, "used_at" = CURRENT_TIMESTAMP 
                 WHERE "code" = $2 AND "used_at" IS NULL`,
                [user.id, submittedCode]
              );
            }
          } catch (e) {
            console.error('[Auth] Error marking invite code as used:', e);
          }
        },
      },
    },
  },
});
