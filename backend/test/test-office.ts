import { getDocumentType } from '../src/routes/office.js';
import { signOfficeJwt, verifyOfficeJwt } from '../src/utils/officeJwt.js';
import { generateFileKey, wrapKey, unwrapKey, encryptBuffer, decryptBuffer } from '../src/utils/crypto.js';

async function runOfficeTests() {
  console.log('===========================================================');
  console.log('🚀 Cloud Drive Phase 7 — OnlyOffice Integration Test Suite');
  console.log('===========================================================\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Office File & Document Type Detection
    // -------------------------------------------------------------
    console.log('[Test 1] Testing OnlyOffice document type mapping...');
    const testCases = [
      { name: 'document.docx', expected: 'word' },
      { name: 'notes.txt', expected: 'word' },
      { name: 'resume.odt', expected: 'word' },
      { name: 'finances.xlsx', expected: 'cell' },
      { name: 'data.csv', expected: 'cell' },
      { name: 'sheet.ods', expected: 'cell' },
      { name: 'pitch.pptx', expected: 'slide' },
      { name: 'presentation.odp', expected: 'slide' },
      { name: 'image.png', expected: null },
      { name: 'video.mp4', expected: null },
    ];

    for (const tc of testCases) {
      const actual = getDocumentType(tc.name);
      if (actual !== tc.expected) {
        throw new Error(`Document type mapping failed for "${tc.name}". Expected: ${tc.expected}, Got: ${actual}`);
      }
    }
    console.log('✓ Document type mapping for Word, Excel, and PowerPoint verified.\n');

    // -------------------------------------------------------------
    // Test 2: OnlyOffice HMAC-SHA256 JWT Signing and Verification
    // -------------------------------------------------------------
    console.log('[Test 2] Testing OnlyOffice JWT generation and signature verification...');
    const payload = {
      documentType: 'word',
      document: {
        title: 'Project_Proposal.docx',
        url: 'https://drive2.govindvaghasiya.ca/api/office/files/123/stream?token=abc',
        fileType: 'docx',
        key: 'file123_1724760000',
        permissions: {
          edit: true,
          download: true,
          print: true,
        },
      },
      editorConfig: {
        mode: 'edit',
        callbackUrl: 'https://drive2.govindvaghasiya.ca/api/office/callback/123',
        user: { id: 'user-uuid-1', name: 'Govind' },
      },
    };

    const token = signOfficeJwt(payload);
    if (!token || token.split('.').length !== 3) {
      throw new Error('JWT token format is invalid');
    }

    const verified = verifyOfficeJwt(token);
    if (!verified.valid || verified.payload?.document?.title !== 'Project_Proposal.docx') {
      throw new Error(`JWT verification failed: ${verified.error}`);
    }

    // Test tamper detection
    const tamperedToken = token.slice(0, -4) + 'abcd';
    const tamperedCheck = verifyOfficeJwt(tamperedToken);
    if (tamperedCheck.valid) {
      throw new Error('Tampered token unexpectedly passed verification');
    }
    console.log('✓ OnlyOffice JWT signing, verification, and tamper protection verified.\n');

    // -------------------------------------------------------------
    // Test 3: Save Callback Re-encryption Simulation
    // -------------------------------------------------------------
    console.log('[Test 3] Simulating OnlyOffice save callback and AES-256-GCM re-encryption...');
    const editedOfficeFileBuffer = Buffer.from('Edited Document Content by OnlyOffice DocEditor v8.2');

    // Generate new key and re-encrypt
    const fileKey = generateFileKey();
    const wrappedKey = wrapKey(fileKey);
    const encrypted = encryptBuffer(editedOfficeFileBuffer, fileKey);

    // Verify decryption
    const unwrappedKey = unwrapKey(wrappedKey);
    const decrypted = decryptBuffer(encrypted, unwrappedKey);

    if (!decrypted.equals(editedOfficeFileBuffer)) {
      throw new Error('Decrypted saved buffer does not match original edited buffer');
    }
    console.log('✓ Save callback AES-256-GCM re-encryption roundtrip verified.\n');

    console.log('===========================================================');
    console.log('🎉 ALL PHASE 7 ONLYOFFICE TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('===========================================================');
  } catch (err: any) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runOfficeTests();
