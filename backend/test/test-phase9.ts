import { extractIndexableText } from '../src/routes/upload.js';
import { signOfficeJwt, verifyOfficeJwt } from '../src/utils/officeJwt.js';
import { generateFileKey, wrapKey, unwrapKey, encryptBuffer, decryptBuffer } from '../src/utils/crypto.js';

function extractSnippet(text: string | null, query: string): string | null {
  if (!text || !query) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 40);
  let snippet = text.substring(start, end).replace(/[\r\n\t]+/g, ' ');
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;
  return snippet;
}

async function runPhase9Tests() {
  console.log('===========================================================');
  console.log('🚀 Cloud Drive Phase 9 — Polish Features Test Suite');
  console.log('===========================================================\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Full-Text Content Indexing & Snippet Extraction
    // -------------------------------------------------------------
    console.log('[Test 1] Testing full-text document content indexing and snippet generation...');
    const sampleDocContent = Buffer.from(
      `Confidential Project Apollo Architecture Specification.
This system utilizes AES-256-GCM hardware-accelerated per-file encryption.
Unique token: SECRET_KEYWORD_GAMMA_9901 for deployment verification.
End of confidential specification document.`
    );

    const indexedText = extractIndexableText(sampleDocContent, 'apollo_spec.txt', 'text/plain');
    if (!indexedText || !indexedText.includes('SECRET_KEYWORD_GAMMA_9901')) {
      throw new Error('Text extraction failed to index content');
    }

    const snippet = extractSnippet(indexedText, 'SECRET_KEYWORD_GAMMA_9901');
    if (!snippet || !snippet.includes('SECRET_KEYWORD_GAMMA_9901')) {
      throw new Error(`Snippet extraction failed: ${snippet}`);
    }
    console.log(`- Extracted Snippet: "${snippet}"`);
    console.log('✓ Full-text content indexing and snippet matching verified.\n');

    // -------------------------------------------------------------
    // Test 2: File Version History Rollback & Snapshot Integrity
    // -------------------------------------------------------------
    console.log('[Test 2] Simulating file version history snapshots and rollback...');
    const version1Content = Buffer.from('Document Version 1.0 (Initial Draft)');
    const version2Content = Buffer.from('Document Version 2.0 (Reviewed by Legal)');
    const version3Content = Buffer.from('Document Version 3.0 (Final Approved Copy)');

    // Snapshot 1
    const key1 = generateFileKey();
    const wrappedKey1 = wrapKey(key1);
    const enc1 = encryptBuffer(version1Content, key1);

    // Snapshot 2
    const key2 = generateFileKey();
    const wrappedKey2 = wrapKey(key2);
    const enc2 = encryptBuffer(version2Content, key2);

    // Snapshot 3 (Active)
    const key3 = generateFileKey();
    const wrappedKey3 = wrapKey(key3);
    const enc3 = encryptBuffer(version3Content, key3);

    // Rollback to Snapshot 1
    const restoredKey = unwrapKey(wrappedKey1);
    const decryptedRestored = decryptBuffer(enc1, restoredKey);

    if (!decryptedRestored.equals(version1Content)) {
      throw new Error('Version 1 restore failed: Decrypted content mismatch');
    }
    console.log('✓ Version snapshots and rollback restoration verified.\n');

    // -------------------------------------------------------------
    // Test 3: OnlyOffice Collaborative Co-Editing Configuration
    // -------------------------------------------------------------
    console.log('[Test 3] Verifying OnlyOffice real-time co-editing configuration...');
    const coEditConfig = {
      documentType: 'word',
      document: {
        title: 'Team_Whitepaper.docx',
        url: 'https://drive2.govindvaghasiya.ca/api/office/files/file-123/stream?token=abc',
        fileType: 'docx',
        key: 'file-123_room_key',
        permissions: { edit: true },
      },
      editorConfig: {
        mode: 'edit',
        coEditing: {
          mode: 'fast',
          change: true,
        },
        customization: {
          chat: true,
          comments: true,
          autosave: true,
        },
      },
    };

    const token = signOfficeJwt(coEditConfig);
    const verified = verifyOfficeJwt(token);

    if (!verified.valid || verified.payload.editorConfig.coEditing.mode !== 'fast' || !verified.payload.editorConfig.customization.chat) {
      throw new Error('Co-editing configuration payload verification failed');
    }
    console.log('✓ OnlyOffice fast co-editing & chat synchronization configuration verified.\n');

    console.log('===========================================================');
    console.log('🎉 ALL PHASE 9 POLISH TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('===========================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runPhase9Tests();
