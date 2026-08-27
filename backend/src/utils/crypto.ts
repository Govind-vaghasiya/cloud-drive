import crypto from 'crypto';
import fs from 'fs';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import dotenv from 'dotenv';

dotenv.config();

// Ensure master key is exactly 32 bytes (256 bits)
function getMasterKey(): Buffer {
  const rawKey = process.env.MASTER_ENCRYPTION_KEY || 'default_master_encryption_key_please_change_in_production_32bytes';
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Generate a cryptographically secure 256-bit random key for a file
 */
export function generateFileKey(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Wrap (encrypt) the 32-byte per-file key using the server master key (AES-256-GCM)
 * Returns a colon-separated string: "iv_hex:auth_tag_hex:ciphertext_hex"
 */
export function wrapKey(fileKey: Buffer): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

  const encryptedKey = Buffer.concat([cipher.update(fileKey), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedKey.toString('hex')}`;
}

/**
 * Unwrap (decrypt) the per-file key using the server master key
 */
export function unwrapKey(wrappedKeyString: string): Buffer {
  const masterKey = getMasterKey();
  const parts = wrappedKeyString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid wrapped key format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedKey = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedKey), decipher.final()]);
}

/**
 * Encrypt a buffer in-memory using AES-256-GCM.
 * Packed format: [12 bytes IV] + [16 bytes Auth Tag] + [Ciphertext]
 */
export function encryptBuffer(data: Buffer, fileKey: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt a buffer in-memory using AES-256-GCM.
 * Input format: [12 bytes IV] + [16 bytes Auth Tag] + [Ciphertext]
 */
export function decryptBuffer(packedBuffer: Buffer, fileKey: Buffer): Buffer {
  if (packedBuffer.length < 28) {
    throw new Error('Encrypted buffer too short to contain valid headers');
  }

  const iv = packedBuffer.subarray(0, 12);
  const authTag = packedBuffer.subarray(12, 28);
  const ciphertext = packedBuffer.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt a file from disk or buffer and save it to the destination file.
 */
export async function encryptFileToDisk(
  sourcePathOrBuffer: string | Buffer,
  destPath: string,
  fileKey: Buffer
): Promise<number> {
  const buffer = Buffer.isBuffer(sourcePathOrBuffer)
    ? sourcePathOrBuffer
    : await fs.promises.readFile(sourcePathOrBuffer);

  const encrypted = encryptBuffer(buffer, fileKey);
  await fs.promises.writeFile(destPath, encrypted);
  return encrypted.length;
}

/**
 * Decrypt a file from disk and return readable stream or buffer.
 */
export async function decryptFileFromDisk(
  encryptedFilePath: string,
  fileKey: Buffer
): Promise<Buffer> {
  const encryptedBuffer = await fs.promises.readFile(encryptedFilePath);
  return decryptBuffer(encryptedBuffer, fileKey);
}

/**
 * Hash a public share password using scrypt with random salt.
 */
export function hashSharePassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Timing-safe verification of a public share password.
 */
export function verifySharePassword(password: string, combinedHash: string): boolean {
  try {
    const parts = combinedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const computedHash = crypto.scryptSync(password, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

