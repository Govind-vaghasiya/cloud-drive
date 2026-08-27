import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  domain: string;
  baseUrl: string;
  masterKey: string;
  betterAuthSecret: string;
  onlyofficeSecret: string;
  onlyofficeUrl: string;
  storageDir: string;
}

export function loadAndValidateConfig(): AppConfig {
  const env = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const port = parseInt(process.env.PORT || '5000', 10);
  const domain = process.env.APP_DOMAIN || 'drive2.govindvaghasiya.ca';
  const baseUrl = process.env.BASE_URL || `https://${domain}`;

  const masterKey = process.env.MASTER_ENCRYPTION_KEY || 'default_master_encryption_key_please_change_in_production_32bytes';
  const betterAuthSecret = process.env.BETTER_AUTH_SECRET || 'dev_secret_auth_32_characters_long_key_123';
  const onlyofficeSecret = process.env.ONLYOFFICE_JWT_SECRET || 'dev_onlyoffice_jwt_secret_key_12345';
  const onlyofficeUrl = process.env.ONLYOFFICE_URL || 'http://onlyoffice';
  const storageDir = process.env.STORAGE_DIR || './data/storage';

  if (env === 'production') {
    const warnings: string[] = [];

    if (masterKey.startsWith('default_') || masterKey.length < 32) {
      warnings.push('MASTER_ENCRYPTION_KEY is using a weak or default development key.');
    }
    if (betterAuthSecret.startsWith('dev_') || betterAuthSecret.length < 32) {
      warnings.push('BETTER_AUTH_SECRET is using a default development secret.');
    }
    if (onlyofficeSecret.startsWith('dev_') || onlyofficeSecret.length < 16) {
      warnings.push('ONLYOFFICE_JWT_SECRET is using a default development secret.');
    }

    if (warnings.length > 0) {
      console.warn('\n⚠️  [PRODUCTION SECURITY WARNING]');
      warnings.forEach((w) => console.warn(`   - ${w}`));
      console.warn('   Please provide strong unique random secrets in your .env file for production!\n');
    }
  }

  return {
    env,
    port,
    domain,
    baseUrl,
    masterKey,
    betterAuthSecret,
    onlyofficeSecret,
    onlyofficeUrl,
    storageDir,
  };
}

export const config = loadAndValidateConfig();
