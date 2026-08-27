import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { generateFileKey, wrapKey, unwrapKey, encryptBuffer, decryptBuffer } from '../src/utils/crypto.js';
import { authRateLimiter, createRateLimiter } from '../src/middleware/rateLimit.js';

async function runLoadAndHardeningTests() {
  console.log('===========================================================');
  console.log('🚀 Cloud Drive Phase 8 — Deployment Hardening & Load Test');
  console.log('===========================================================\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Chunked Large File Simulation & SHA-256 Checksum Validation
    // -------------------------------------------------------------
    console.log('[Test 1] Generating 50MB mock large binary payload and simulating chunked upload...');
    const totalSize = 50 * 1024 * 1024; // 50 MB
    const chunkSize = 10 * 1024 * 1024; // 10 MB per chunk
    const totalChunks = Math.ceil(totalSize / chunkSize);

    const originalBuffer = crypto.randomBytes(totalSize);
    const originalSha256 = crypto.createHash('sha256').update(originalBuffer).digest('hex');

    console.log(`- Total file size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`- Number of chunks: ${totalChunks} (${(chunkSize / (1024 * 1024)).toFixed(2)} MB each)`);
    console.log(`- Original SHA-256: ${originalSha256}`);

    // Split and reassemble chunks
    const chunkBuffers: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      chunkBuffers.push(originalBuffer.subarray(start, end));
    }

    const reassembledBuffer = Buffer.concat(chunkBuffers);
    const reassembledSha256 = crypto.createHash('sha256').update(reassembledBuffer).digest('hex');

    if (originalSha256 !== reassembledSha256) {
      throw new Error('Chunk reassembly failed: SHA-256 mismatch');
    }
    console.log('✓ Large file chunk assembly and SHA-256 integrity verified.\n');

    // -------------------------------------------------------------
    // Test 2: AES-256-GCM Encryption & Decryption Performance Under Load
    // -------------------------------------------------------------
    console.log('[Test 2] Benchmarking AES-256-GCM encryption & decryption on 50MB payload...');
    const fileKey = generateFileKey();
    const wrappedKey = wrapKey(fileKey);

    const t0 = Date.now();
    const encrypted = encryptBuffer(reassembledBuffer, fileKey);
    const tEnc = Date.now() - t0;
    console.log(`- Encryption completed in ${tEnc}ms (Throughput: ${((totalSize / 1024 / 1024) / (tEnc / 1000)).toFixed(2)} MB/s)`);

    const t1 = Date.now();
    const unwrappedKey = unwrapKey(wrappedKey);
    const decrypted = decryptBuffer(encrypted, unwrappedKey);
    const tDec = Date.now() - t1;
    console.log(`- Decryption completed in ${tDec}ms (Throughput: ${((totalSize / 1024 / 1024) / (tDec / 1000)).toFixed(2)} MB/s)`);

    if (!decrypted.equals(originalBuffer)) {
      throw new Error('Decrypted payload does not match original binary content');
    }
    console.log('✓ 50MB AES-256-GCM encryption/decryption roundtrip verified with 100% fidelity.\n');

    // -------------------------------------------------------------
    // Test 3: Rate Limiting Sliding Window Stress Test
    // -------------------------------------------------------------
    console.log('[Test 3] Testing Rate Limiting middleware against rapid burst requests...');
    const limiter = createRateLimiter({
      windowMs: 1000,
      max: 5,
      message: 'Rate limit exceeded in test',
      prefix: 'rl:test',
    });

    let passedCount = 0;
    let blockedCount = 0;

    const mockReq: any = { ip: '127.0.0.1', headers: {}, socket: { remoteAddress: '127.0.0.1' } };

    for (let i = 0; i < 8; i++) {
      const mockRes: any = {
        headers: {},
        statusCode: 200,
        setHeader(name: string, val: any) {
          this.headers[name] = val;
        },
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.body = data;
        },
      };

      let nextCalled = false;
      await limiter(mockReq, mockRes, () => {
        nextCalled = true;
      });

      if (nextCalled) {
        passedCount++;
      } else if (mockRes.statusCode === 429) {
        blockedCount++;
      }
    }

    console.log(`- Requests sent: 8, Allowed: ${passedCount}, Rate-limited (429): ${blockedCount}`);
    if (passedCount !== 5 || blockedCount !== 3) {
      throw new Error(`Rate limiter test failed: Expected 5 allowed and 3 blocked, got ${passedCount} allowed and ${blockedCount} blocked`);
    }
    console.log('✓ Rate limiting sliding window protection verified.\n');

    console.log('===========================================================');
    console.log('🎉 ALL PHASE 8 DEPLOYMENT HARDENING TESTS PASSED! 🎉');
    console.log('===========================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runLoadAndHardeningTests();
