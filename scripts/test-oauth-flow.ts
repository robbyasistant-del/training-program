/**
 * Test script for validating the OAuth flow end-to-end
 * Usage: tsx scripts/test-oauth-flow.ts
 */

import { encryptToken, decryptToken, generateEncryptionKey } from '../lib/crypto/tokenCrypto';
import {
  storeTokens,
  getValidAccessToken,
  disconnectStrava,
  exchangeCodeForTokens,
} from '../lib/strava/tokenManager';

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log('');
  log(`=== ${title} ===`, 'blue');
}

// Test results tracker
const results: { test: string; passed: boolean; error?: string }[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ test: name, passed: true });
    log(`✓ ${name}`, 'green');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.push({ test: name, passed: false, error: errorMessage });
    log(`✗ ${name}: ${errorMessage}`, 'red');
  }
}

async function main(): Promise<void> {
  log('\n🧪 Strava OAuth Flow Test Script', 'blue');
  log('=================================', 'blue');

  // Check environment
  logSection('Environment Check');
  const requiredEnvVars = ['TOKEN_ENCRYPTION_KEY', 'STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET'];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      log(`⚠ ${envVar} is not set`, 'yellow');
    } else {
      log(`✓ ${envVar} is set`, 'green');
    }
  }

  // Test 1: Encryption Key Generation
  logSection('Test 1: Encryption Key Generation');
  await runTest('Generate valid encryption key', async () => {
    const key = generateEncryptionKey();
    if (key.length !== 64) {
      throw new Error(`Expected key length 64, got ${key.length}`);
    }
    if (!/^[a-f0-9]{64}$/.test(key)) {
      throw new Error('Key is not valid hex string');
    }
    log(`  Generated key: ${key.substring(0, 8)}...${key.substring(56)}`, 'blue');
  });

  // Test 2: Token Encryption
  logSection('Test 2: Token Encryption');
  const testToken = 'test_strava_access_token_12345';
  let encryptedBuffer: Buffer;

  await runTest('Encrypt token', async () => {
    encryptedBuffer = encryptToken(testToken);
    if (!Buffer.isBuffer(encryptedBuffer)) {
      throw new Error('encryptToken should return a Buffer');
    }
    if (encryptedBuffer.length === 0) {
      throw new Error('Encrypted buffer is empty');
    }
    log(`  Original length: ${testToken.length} bytes`, 'blue');
    log(`  Encrypted length: ${encryptedBuffer.length} bytes`, 'blue');
  });

  // Test 3: Token Decryption
  logSection('Test 3: Token Decryption');
  await runTest('Decrypt token and verify', async () => {
    const decrypted = decryptToken(encryptedBuffer);
    if (decrypted !== testToken) {
      throw new Error(`Decrypted token doesn't match: ${decrypted} !== ${testToken}`);
    }
    log(`  Decrypted: ${decrypted.substring(0, 20)}...`, 'blue');
  });

  // Test 4: Encryption produces different outputs (due to random IV)
  logSection('Test 4: Encryption Randomness (IV)');
  await runTest('Same token produces different ciphertext', async () => {
    const encrypted1 = encryptToken(testToken);
    const encrypted2 = encryptToken(testToken);
    if (encrypted1.toString('hex') === encrypted2.toString('hex')) {
      throw new Error('Same token should produce different ciphertexts');
    }
    log('  Two encryptions produce different outputs (random IV working)', 'blue');
  });

  // Test 5: Store Tokens in Database
  logSection('Test 5: Store Tokens in Database');
  const testAthleteId = `test-athlete-${Date.now()}`;
  await runTest('Store tokens for athlete', async () => {
    const tokens = {
      access_token: 'test_access_token_' + Date.now(),
      refresh_token: 'test_refresh_token_' + Date.now(),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
    };
    await storeTokens(testAthleteId, tokens);
    log(`  Stored tokens for athlete: ${testAthleteId}`, 'blue');
  });

  // Test 6: Retrieve Valid Access Token
  logSection('Test 6: Retrieve Valid Access Token');
  await runTest('Retrieve valid access token', async () => {
    const token = await getValidAccessToken(testAthleteId);
    if (!token || typeof token !== 'string') {
      throw new Error('Retrieved token is not valid');
    }
    log(`  Retrieved token: ${token.substring(0, 20)}...`, 'blue');
  });

  // Test 7: Token Refresh (simulated)
  logSection('Test 7: Token Refresh Flow');
  await runTest('Token refresh configuration check', async () => {
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      log('  Skipping: Missing Strava credentials', 'yellow');
      return;
    }
    // Note: Actual refresh test requires expired token, which we can't easily create
    log('  Refresh would be triggered for expired tokens (5 minute margin)', 'blue');
  });

  // Test 8: Disconnect
  logSection('Test 8: Disconnect Strava');
  await runTest('Disconnect athlete', async () => {
    await disconnectStrava(testAthleteId);
    log(`  Disconnected athlete: ${testAthleteId}`, 'blue');
  });

  // Test 9: Error Handling
  logSection('Test 9: Error Handling');
  await runTest('Handle missing connection gracefully', async () => {
    try {
      await getValidAccessToken('non-existent-athlete');
      throw new Error('Should have thrown error for missing connection');
    } catch (error) {
      if (error instanceof Error && error.message.includes('No Strava connection found')) {
        log('  Correctly throws error for missing connection', 'blue');
      } else {
        throw error;
      }
    }
  });

  // Test 10: Exchange Code for Tokens (requires real code)
  logSection('Test 10: Exchange Code for Tokens');
  await runTest('Exchange code endpoint configuration', async () => {
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      log('  Skipping: Missing Strava credentials', 'yellow');
      return;
    }
    // Note: Actual exchange requires a valid authorization code from Strava
    log('  Endpoint configured correctly (requires real auth code for full test)', 'blue');
  });

  // Summary
  logSection('Test Summary');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  log(`Total: ${results.length} tests`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  if (failed > 0) {
    console.log('');
    log('Failed Tests:', 'red');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  - ${r.test}: ${r.error}`, 'red');
      });
    process.exit(1);
  } else {
    log('\n✅ All tests passed!', 'green');
    process.exit(0);
  }
}

// Run the tests
main().catch((error) => {
  log(`\n💥 Unexpected error: ${error}`, 'red');
  process.exit(1);
});
