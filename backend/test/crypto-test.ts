import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { 
  generateFileKey, 
  wrapKey, 
  unwrapKey, 
  encryptBuffer, 
  decryptBuffer, 
  encryptFileToDisk, 
  decryptFileFromDisk 
} from '../src/utils/crypto.js';

async function runTests() {
  console.log('=== Running Crypto & Storage Unit Tests ===');

  // Test 1: Key Generation & Wrapping
  console.log('Test 1: Testing AES-256-GCM Key Generation and Master Key Wrapping...');
  const originalFileKey = generateFileKey();
  assert.strictEqual(originalFileKey.length, 32, 'File key must be 32 bytes (256 bits)');

  const wrappedKey = wrapKey(originalFileKey);
  assert.ok(wrappedKey.includes(':'), 'Wrapped key must contain IV:AuthTag:Ciphertext');

  const unwrappedFileKey = unwrapKey(wrappedKey);
  assert.deepStrictEqual(unwrappedFileKey, originalFileKey, 'Unwrapped key must match original key exactly');
  console.log('✔ Key wrapping and unwrapping test passed.');

  // Test 2: Buffer Encryption & Decryption
  console.log('Test 2: Testing In-Memory AES-256-GCM Encryption and Decryption...');
  const testPayload = Buffer.from('Cloud Drive: Confidential Document Content for Govind Vaghasiya 🚀🔐', 'utf-8');
  const encryptedBuffer = encryptBuffer(testPayload, originalFileKey);
  
  assert.ok(encryptedBuffer.length >= testPayload.length + 28, 'Encrypted buffer must include 12B IV + 16B Tag');
  assert.notDeepStrictEqual(encryptedBuffer, testPayload, 'Encrypted buffer must not equal plaintext');

  const decryptedBuffer = decryptBuffer(encryptedBuffer, originalFileKey);
  assert.deepStrictEqual(decryptedBuffer, testPayload, 'Decrypted buffer must match original payload exactly');
  console.log('✔ Buffer encryption and decryption test passed.');

  // Test 3: Disk File Encryption & Decryption
  console.log('Test 3: Testing Disk File Encryption and Decryption...');
  const tempDir = path.join(process.cwd(), 'data', 'temp_test');
  fs.mkdirSync(tempDir, { recursive: true });
  
  const rawFilePath = path.join(tempDir, 'test_raw.txt');
  const encFilePath = path.join(tempDir, 'test_enc.enc');
  
  await fs.promises.writeFile(rawFilePath, testPayload);
  await encryptFileToDisk(rawFilePath, encFilePath, originalFileKey);
  
  const decryptedFromDisk = await decryptFileFromDisk(encFilePath, originalFileKey);
  assert.deepStrictEqual(decryptedFromDisk, testPayload, 'Decrypted file from disk must match original payload');
  
  // Clean up
  await fs.promises.unlink(rawFilePath).catch(() => {});
  await fs.promises.unlink(encFilePath).catch(() => {});
  await fs.promises.rmdir(tempDir).catch(() => {});
  console.log('✔ Disk file encryption and decryption test passed.');

  console.log('=== All Crypto Tests Passed Successfully! ===');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
